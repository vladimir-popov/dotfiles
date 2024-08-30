return {
    'nvim-neo-tree/neo-tree.nvim',
    -- branch = 'v3.x',
    keys = {
        {
            "<leader>'",
            ':Neotree toggle reveal<cr>',
            desc = 'Show the current file in the NeoTree',
        },
        {
            '<leader>"',
            ':Neotree focus reveal_force_cwd<cr>',
            desc = 'Show the current file in the NeoTree, and change cwd',
        },
        {
            '<leader>1',
            ':Neotree show reveal<cr>',
            desc = 'Show the current file in the Files'
        },
        {
            '<leader>2',
            ':Neotree show buffers<cr>',
            desc = 'Show the current file in the Buffers',
        },
        {
            '<leader>3',
            ':Neotree show document_symbols<cr>',
            desc = 'Show the symbols in the current document obtained by the LSP',
        },
        {
            '<leader>4',
            ':Neotree show git_status<cr>',
            desc = 'Show the current file in the Git',
        },
    },
    dependencies = {
        'nvim-lua/plenary.nvim',
        'nvim-tree/nvim-web-devicons',
        'MunifTanjim/nui.nvim',
    },
    config = function()
        vim.fn.sign_define('DiagnosticSignError', { text = ' ', texthl = 'DiagnosticSignError' })
        vim.fn.sign_define('DiagnosticSignWarn', { text = ' ', texthl = 'DiagnosticSignWarn' })
        vim.fn.sign_define('DiagnosticSignInfo', { text = ' ', texthl = 'DiagnosticSignInfo' })
        vim.fn.sign_define('DiagnosticSignHint', { text = '󰌵', texthl = 'DiagnosticSignHint' })

        require('neo-tree').setup({
            enable_diagnostics = true,
            close_if_last_window = true,
            window = {
                position = 'left',
                width = 40,
            },
            sources = {
                'filesystem',
                'buffers',
                'git_status',
                'document_symbols',
            },
            source_selector = {
                winbar = true,
                statusline = false,
                sources = {
                    { source = "filesystem" },
                    { source = "buffers" },
                    { source = "document_symbols" },
                    { source = "git_status" },
                },
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
                follow_current_file = true,
                group_empty_dirs = true,
                window = {
                    mappings = {
                        ['<space>gg'] = 'live_grep',
                    },
                },
                commands = {
                    live_grep = function(state)
                        local node = state.tree:get_node()
                        local path = node:get_id()
                        vim.cmd("wincmd w")
                        require('telescope.builtin').live_grep({
                            prompt_title = 'Find string in ' .. path,
                            cwd = path,
                        })
                    end,
                },
            },
            buffers = {
                follow_current_file = {
                    enabled = true
                },
                group_empty_dirs = true
            },
            document_symbols = {
                kinds = {
                    File = { icon = '󰈙', hl = 'Tag' },
                    Namespace = { icon = '󰌗', hl = 'Include' },
                    Package = { icon = '󰏖', hl = 'Label' },
                    Class = { icon = '󰌗', hl = 'Include' },
                    Property = { icon = '󰆧', hl = '@property' },
                    Enum = { icon = '󰒻', hl = '@number' },
                    Function = { icon = '󰊕', hl = 'Function' },
                    String = { icon = '󰀬', hl = 'String' },
                    Number = { icon = '󰎠', hl = 'Number' },
                    Array = { icon = '󰅪', hl = 'Type' },
                    Object = { icon = '󰅩', hl = 'Type' },
                    Key = { icon = '󰌋', hl = '' },
                    Struct = { icon = '󰌗', hl = 'Type' },
                    Operator = { icon = '󰆕', hl = 'Operator' },
                    TypeParameter = { icon = '󰊄', hl = 'Type' },
                    StaticMethod = { icon = '󰠄 ', hl = 'Function' },
                },
            },
        })
    end,
}
