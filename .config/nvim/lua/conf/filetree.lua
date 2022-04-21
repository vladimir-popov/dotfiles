local M = {}

M.setup = function()
    -- will enable file highlight for git attributes
    vim.g.nvim_tree_git_hl = 1
    vim.g.nvim_tree_icons = {
        default = '',
        symlink = '',
        git = {
            unstaged = '',
            staged = '✓',
            unmerged = '',
            renamed = '➜',
            untracked = '★',
            deleted = '',
            ignored = '◌',
        },
    }

    local u = require('utils')
    u.nmap("<leader>'", ':NvimTreeToggle<cr>')
    u.nmap('<leader>"', ':NvimTreeFindFile<cr>')

    require('nvim-tree').setup({
        view = {
            width = 50,
        },
        -- will position the cursor at the start of the file on the current line
        hijack_cursor = true,
    })

    return M
end

return M
