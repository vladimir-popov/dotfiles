local fs = vim.fs
local fn = vim.fn
local uv = vim.loop

local function find_git_root(working_directory, git_directory)
    local function is_git_dir(path)
        local dir = path .. '/' .. git_directory
        return fn.isdirectory(dir)
    end

    local git_root = is_git_dir(working_directory) and working_directory or nil
    if not git_root then
        for dir in fs.parents(working_directory) do
            if is_git_dir(dir) then
                git_root = dir
                break
            end
        end
    end
    return git_root
end

local function read_git_branch(git_HEAD_path)
    local line = io.lines(git_HEAD_path)()
    local branch = string.match(line, 'ref: /refs/heads/(.+)')
        or string.match(line, 'ref: /refs/tags/(.+)')
        or string.match(line, 'ref: /refs/remotes/(.+)')
    return branch or line:sub(1, #line - 7)
end

local function read_git_staged(git_index_path)
    local f = io.open(git_index_path, 'r')
    if not f then
        return nil
    end
    local index = f:read('*a')
    f:close()
    return string.find(index, 'Staged') ~= nil
end

---@class GitProvider: Object
---@field new fun(working_directory: string, git_directory?: string): GitProvider
--- Creates a new provider around {working_directory} or {vim.fn.getcwd}.
--- Optionaly, the name of the git directory can be passed as {git_root}, or '.git' will be used.
---@field git_branch fun(): string The name of the current branch for the current buffer.
---@field is_git_workspace fun(): boolean `true` when the file of the current buffer is in a git workspace.
---@field is_workspace_changed fun(): boolean `true` if some file in the warkspace was added, or
---  removed, or changed.
local GitProvider = require('lualine.utils.class'):extend()

---@type fun(working_directory?: string, git_directory?: string)
---@param working_directory string Path to the working directory.
---  If absent, result of the {vim.fn.getcwd} will be used.
---@param git_directory string the name of the git directory. `.git` by default.
function GitProvider:init(working_directory, git_directory)
    self.__git_directory = git_directory or '.git'
    self.__working_directory = working_directory or vim.fn.getcwd()
    self.__git_root = find_git_root(self.__working_directory, self.__git_directory)
end

function GitProvider:git_root(subpath)
    if self.__git_root and subpath then
        return string.format('%s/%s/%s', self.__git_root, self.__git_directory, subpath)
    else
        return self.__git_root
    end
end

function GitProvider:get_branch()
    -- git branch already known
    if self.__git_branch then
        return self.__git_branch
    end

    -- git root was not found
    if not self.__git_root then
        return nil
    end

    -- read current branch
    self.__git_branch = read_git_branch(self.git_root('HEAD'))

    -- run poll of HEAD's changes
    self.__poll_head = uv.new_fs_event()
    self.__poll_head:fs_event_start(self.git_root('HEAD'), {}, function()
        self.__git_branch = read_git_branch(self.git_root('HEAD'))
    end)

    return self.__git_branch
end

function GitProvider:is_workspace()
    return self.__git_root ~= nil
end

function GitProvider:is_workspace_changed()
    -- is_staged is already known
    if self.__staged then
        return true
    end

    -- git root was not found
    if not self.__git_root then
        return nil
    end

    -- read is_staged
    self.__staged = read_git_staged(self.git_root('index'))

    -- run poll of the index's changes
    if self.__staged then
        self.__poll_index = uv.new_fs_event()
        self.__poll_index:fs_event_start(self.git_root('index'), {}, function()
            self.__staged = read_git_staged(self.git_root('index'))
        end)
    end

    return self.__staged ~= nil
end

return GitProvider
