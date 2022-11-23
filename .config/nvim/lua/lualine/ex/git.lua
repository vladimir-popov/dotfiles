local fs = vim.fs
local fn = vim.fn
local uv = vim.loop

local function find_git_root(working_directory, git_directory)
    local git_root = value
    for dir in fs.parents(working_directory) do
        if fn.isdirectory(dir .. '/' .. git_directory) then
            git_root = dir
            break
        end
    end
    return git_root
end

local function read_git_branch(git_root)
    local line = io.lines(git_root .. '/HEAD')()
    local branch = string.match(line, 'ref: /refs/heads/(.+)')
        or string.match(line, 'ref: /refs/tags/(.+)')
        or string.match(line, 'ref: /refs/remotes/(.+)')
    return branch or line:sub(1, #line - 7)
end

local function read_git_stages_count(git_root)
    local f = io.open(git_root .. '/index', 'r')
    if not f then
        return nil
    end
    local index = f:read('*a')
    f:close()
    local count = string.match(index, 'Staged %((%d+)%)')
    return count and tonumber(count)
end

---@class GitProvider: Object
---@field git_branch fun(): string The name of the current branch for the current buffer.
---@field is_git_workspace fun(): boolean `true` when the file of the current buffer is in a git workspace.
---@field is_workspace_changed fun(): boolean `true` if some file in the warkspace was added, or
---  removed, or changed.
local GitProvider = require('lualine.utils.class'):extend()

---@type fun(working_directory: string, git_directory?: string): GitProvider
--- Creates a new provider around {working_directory} or {vim.fn.getcwd}.
--- Optionaly, the name of the git directory can be passed as {git_root}, or '.git' will be used.
function GitProvider:init(working_directory, git_directory)
    self.__git_directory = git_directory or '.git'
    self.__working_directory = working_directory or vim.fn.getcwd()
    assert(
        fn.isdirectory(self.__working_directory),
        string.format(
            'The first argument must be a string with path to a directory, but %s was passed.',
            vim.inspect(working_directory)
        )
    )
    self.__git_root = find_git_root(self.__working_directory, self.__git_directory)
end

function GitProvider:git_branch()
    -- git branch already known
    if self.__git_branch then
        return self.__git_branch
    end

    -- git root was not found
    if not self.__git_root then
        return nil
    end

    -- read current branch
    self.__git_branch = read_git_branch(self.__git_root)

    -- run poll of HEAD's changes
    self.__poll_head = uv.new_fs_event()
    self.__poll_head:fs_event_start(self.__git_root .. '/HEAD', {}, function()
        self.__git_branch = read_git_branch(self.__git_root)
    end)

    return self.__git_branch
end

function GitProvider:is_git_workspace()
    return self.__git_root ~= nil
end

function GitProvider:is_workspace_changed()
    -- count of stages is already known
    if self.__stages_count then
        return self.__stages_count > 0
    end

    -- git root was not found
    if not self.__git_root then
        return nil
    end

    -- read count of stages
    self.__stages_count = read_git_stages_count(self.__git_root)

    -- run poll of the index's changes
    if self.__stages_count then
        self.__poll_index = uv.new_fs_event()
        self.__poll_index:fs_event_start(self.__git_root .. '/index', {}, function()
            self.__stages_count = read_git_stages_count(self.__git_root)
        end)
    end

    return (self.__stages_count and self.__stages_count > 0) or false
end

return GitProvider
