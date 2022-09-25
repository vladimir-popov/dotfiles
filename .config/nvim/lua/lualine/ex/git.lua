local ex = require('lualine.ex')

local default_provider

local M = {}

---@class GitChanges
---@field added number count of added lines in the current buffer.
---@field changed number count of changes in the current buffer.
---@field removed number count of removed lines in the current buffer.

---@class GitProvider
---@field git_branch fun(): string The name of the current branch for the current buffer.
---@field git_changes fun(): GitChanges The map with counters of changes in the current buffer.
---@field is_file_changed fun(): boolean `true` if the current file was changed.
---@field is_git_workspace fun(): boolean `true` when the file of the current buffer is in a git workspace.

---@class GitsignsProvider: GitProvider
GitsignsProvider = {}

GitsignsProvider.git_branch = function()
    local dict = vim.b.gitsigns_status_dict
    return dict.head
end

GitsignsProvider.git_changes = function()
    local changes = vim.b.gitsigns_status_dict
    return { added = changes.added, changed = changes.changed, removed = changes.removed }
end

GitsignsProvider.is_file_changed = function()
    local changes = vim.b.gitsigns_status_dict
    return (changes.added + changes.changed + changes.removed) > 0
end

GitsignsProvider.is_git_workspace = function()
    local cwd = vim.fs.normalize(vim.fn.getcwd())
    local git_root = vim.fs.normalize(vim.b.gitsigns_status_dict.root)
    return not ex.is_empty(cwd:find(git_root))
end

---@class FugitiveProvider: GitProvider This is an experimental implementation of the provider.
local FugitiveProvider = {}

FugitiveProvider.init = function()
    local id = vim.api.nvim_create_augroup('lualine_git_status', { clear = true })
    vim.api.nvim_create_autocmd({ 'BufEnter', 'FocusGained', 'BufWritePost' }, {
        group = id,
        pattern = '*',
        command = 'let b:lualine_git_status = systemlist("git status --porcelain")',
    })
end

FugitiveProvider.git_branch = function()
    return vim.fn.FugitiveHead()
end

FugitiveProvider.git_changes = function()
    error("FugitiveProvider doesn't support git changes.")
end

FugitiveProvider.is_file_changed = function()
    return vim.b.lualine_git_status and next(vim.b.lualine_git_status)
end

FugitiveProvider.is_git_workspace = function()
    if not pcall(vim.fn.FugitiveGitDir) then
        error('You should have Fugitive installed.')
    end
    local dir = vim.fn.FugitiveGitDir()
    return not ex.is_empty(dir)
end

M.gitsigns_provider = function()
    if not vim.b.gitsigns_status_dict then
        error('You should have Gitsigns installed.')
    end
    return GitsignsProvider
end

---@deprecated use GitsignsProvider instead.
M.fugitive_provider = function()
    FugitiveProvider.init()
    return FugitiveProvider
end

---@return GitProvider # Tries to find Gitsigns or Fugitive to create appropriate implementation of the {GitProvider}.
M.default_provider = function()
    if default_provider then
        return default_provider
    elseif vim.b.gitsigns_status_dict then
        default_provider = M.gitsigns_provider()
        return default_provider
    elseif pcall(vim.fn.FugitiveGitDir) then
        default_provider = M.fugitive_provider()
        return default_provider
    else
        error('You should have Fugitive or Gitsigns installed to work with git.')
    end
end

return M
