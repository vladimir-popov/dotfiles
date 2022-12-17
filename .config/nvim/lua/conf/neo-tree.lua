local u = require('utils')
u.nmap("<leader>'", ':Neotree toggle reveal<cr>')
u.nmap('<leader>"', ':Neotree toggle reveal_force_cwd<cr>')

u.nmap('<leader>1', ':Neotree toggle<cr>')
u.nmap('<leader>2', ':Neotree source=buffers toggle<cr>')
u.nmap('<leader>3', ':Neotree source=git_status toggle<cr>')

require('neo-tree').setup({
    close_if_last_window = true,
    window = {
        position = 'left',
        width = 35,
    },
    source_selector = {
        winbar = true,
        statusline = false,
    },
    default_component_configs = {
        indent = {
            with_expanders = true,
            expander_collapsed = '',
            expander_expanded = '',
            expander_highlight = 'NeoTreeExpander',
        },
    },
    filesystem = {
        filtered_items = {
            hide_dotfiles = false,
        },
        -- This will find and focus the file in the active buffer every
        -- time the current file is changed while the tree is open.
        follow_current_file = false,
    },
})
