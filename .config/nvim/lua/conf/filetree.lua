local u = require('utils')
u.nmap("<leader>'", ':NvimTreeToggle<cr>')
u.nmap('<leader>"', ':NvimTreeFindFile<cr>')

require('nvim-tree').setup({
    -- Will automatically open the tree when running setup if startup buffer is
    -- a directory, is empty or is unnamed. nvim-tree window will be focused.
    open_on_setup = false,
    -- Changes the tree root directory on `DirChanged` and refreshes the tree.
    sync_root_with_cwd = true,
    view = {
        width = 35,
    },
    -- will enable file highlight for git attributes
    renderer = {
        highlight_git = true,
    },
    -- will position the cursor at the start of the file on the current line
    hijack_cursor = true,
})
