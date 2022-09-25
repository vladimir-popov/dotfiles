local ex = require('lualine.ex')
local g = require('lualine.ex.git').default_provider()

---@class GitBranch: ExComponent
---@field options GitBranchOptions
local GitBranch = require('lualine.component'):extend()


---@class GitBranchColors
---@field changed Color
---@field commited Color

---@class GitBranchOptions: ExComponentOptions
---@field colors GitBranchColors
GitBranch.default_options = {
    icon = ' ',
    colors = {
        changed = { fg = 'orange' },
        commited = { fg = 'green' },
    },
    is_enabled = g.is_git_workspace
}

function GitBranch:init(options)
    options = ex.deep_merge(options, GitBranch.default_options)
    GitBranch.super.init(self, options)
end

function GitBranch:is_enabled()
    local is_disabled = self.options.is_enabled and not self.options.is_enabled()
    return not is_disabled
end

function GitBranch:update_status()
    local colors = self.options.colors
    self.options.color = g.is_file_changed() and colors.changed or colors.commited
    return self:is_enabled() and g.git_branch() or ''
end

return GitBranch
