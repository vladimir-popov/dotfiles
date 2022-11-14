local ex = require('lualine.ex')

---@class GitChanges
---@field added number count of added lines in the current buffer.
---@field changed number count of changes in the current buffer.
---@field removed number count of removed lines in the current buffer.

---@class GitProvider: Object
---@field new fun(): GitProvider The main constructor.
---@field git_branch fun(): string The name of the current branch for the current buffer.
---@field git_changes fun(): GitChanges The map with counters of changes in the current buffer.
---@field is_file_changed fun(): boolean `true` if the current file was changed.
---@field is_git_workspace fun(): boolean `true` when the file of the current buffer is in a git workspace.

---@class GitsignsProvider: GitProvider
local GitsignsProvider = require('lualine.utils.class'):extend()
GitsignsProvider.name = 'GitsignsProvider'

GitsignsProvider.is_available = function()
    return vim.b.gitsigns_status_dict ~= nil
end

function GitsignsProvider:init()
    assert(GitsignsProvider.is_available(), 'You should have Gitsigns installed.')
end

function GitsignsProvider:git_branch()
    local dict = vim.b.gitsigns_status_dict
    return dict.head
end

function GitsignsProvider:git_changes()
    local changes = vim.b.gitsigns_status_dict
    return {
        added = changes.added or 0,
        changed = changes.changed or 0,
        removed = changes.removed or 0,
    }
end

function GitsignsProvider:is_file_changed()
    local changes = self:git_changes()
    return (changes.added + changes.changed + changes.removed) > 0
end

function GitsignsProvider:is_git_workspace()
    local cwd = vim.fs.normalize(vim.fn.getcwd())
    local git_root = vim.fs.normalize(vim.b.gitsigns_status_dict.root)
    return cwd:find(git_root) ~= nil
end

function GitsignsProvider:is_workspace_changed()

end

local provider = {
    GitsignsProvider = GitsignsProvider,
}

setmetatable(provider, {
    __call = function()
        if GitsignsProvider.is_available() then
            return GitsignsProvider:new()
        else
            error('No one provider was found.')
        end
    end,
})

return {
    provider = provider,
}
