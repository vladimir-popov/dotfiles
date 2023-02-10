return {
    'nvim-neo-tree/neo-tree.nvim',
    branch = 'v2.x',
    keys = {
        { "<leader>'", ':Neotree toggle reveal<cr>', desc = 'NeoTree' },
        { "<leader>'", ':Neotree toggle reveal_force_cwd<cr>', desc = 'NeoTree' },
    },
    dependencies = {
        'nvim-lua/plenary.nvim',
        'nvim-tree/nvim-web-devicons',
        'MunifTanjim/nui.nvim',
    },
    opts = {
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
    },
}
