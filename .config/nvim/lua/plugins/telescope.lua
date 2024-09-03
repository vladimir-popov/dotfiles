return {
    'nvim-telescope/telescope.nvim',
    dependencies = {
        'natecraddock/telescope-zf-native.nvim',
        "nvim-telescope/telescope-live-grep-args.nvim",
    },
    config = function()
        local actions = require('telescope.actions')
        local lga_actions = require("telescope-live-grep-args.actions")
        require('telescope').setup({
            extensions = {
                live_grep_args = {
                    auto_quoting = true, -- enable/disable auto-quoting
                    -- define mappings, e.g.
                    mappings = {
                           -- extend mappings
                        i = {
                            ["<C-k>"] = lga_actions.quote_prompt(),
                            ["<C-i>"] = lga_actions.quote_prompt({ postfix = " --iglob " }),
                            ["<C-t>"] = lga_actions.quote_prompt({ postfix = " -t" }),
                            -- freeze the current list and start a fuzzy search in the frozen list
                            ["<C-space>"] = actions.to_fuzzy_refine,
                        },
                    },
                    -- ... also accepts theme settings, for example:
                    -- theme = "dropdown", -- use dropdown theme
                    -- theme = { }, -- use own theme spec
                    -- layout_config = { mirror=true }, -- mirror preview pane
                }
            },
            defaults = {
                mappings = {
                    i = {
                        ['<esc>'] = actions.close,
                    },
                },
            },
            pickers = {
                find_files = {
                    sort_lastused = true,
                    path_display = { 'smart' },
                    layout_config = { width = 0.9 },
                },
                buffers = {
                    theme = 'dropdown',
                    sort_lastused = true,
                    previewer = false,
                    path_display = { 'smart' },
                    layout_strategy = 'center',
                    mappings = {
                        i = {
                            ['<c-d>'] = actions.delete_buffer + actions.move_to_top,
                        },
                    },
                },
                oldfiles = {
                    sort_lastused = true,
                    previewer = false,
                    path_display = { 'smart' },
                    theme = 'dropdown',
                    layout_config = { width = 0.9 },
                },
                live_grep = {
                    path_display = { 'smart' },
                    layout_config = { width = 0.9 },
                },
                help_tags = {
                    previewer = false,
                    theme = 'dropdown',
                    mappings = {
                        i = {
                            ['<CR>'] = actions.select_tab,
                        },
                    },
                },
                lsp_document_symbols = {
                    theme = 'dropdown',
                },
                lsp_workspace_diagnostics = {
                    severity = 'error',
                    path_display = { 'smart' },
                    layout_config = { width = 0.9 },
                },
                colorscheme = {
                    enable_preview = true,
                },
            },
        })
        require('telescope').load_extension('zf-native')
        require('telescope').load_extension("live_grep_args")
    end,
    keys = {
        {
            '<space>;',
            "<cmd>lua require'telescope.builtin'.builtin()<cr>",
            desc = 'show all builtin pickers',
        },
        {
            '<space>fa',
            "<cmd>lua require('telescope.builtin').find_files({file_ignore_patterns = { 'target/' }})<CR>",
            desc = 'find files (without hidden and filtered)',
        },
        {
            '<space>fA',
            "<cmd>lua require('telescope.builtin').find_files({ hidden = true })<CR>",
            desc = 'find all files',
        },
        {
            '<space>fc',
            "<cmd>lua require('telescope.builtin').find_files({ find_command = { 'find', '.', '-name', '*.c', '-o', '-name', '*.h', '-o', '-name', '*.cpp' }, results_title = 'C/C++ files' })<CR>",
            desc = 'find C/C++ files',
        },
        {
            '<space>fC',
            "<cmd>lua require('telescope.builtin').find_files({ find_command = { 'find', '-L', '.', '-name', '*.c', '-o', '-name', '*.h', '-o', '-name', '*.cpp' }, results_title = 'C/C++ files with symlinks' })<CR>",
            desc = 'find C/C++ files',
        },
        {
            '<space>fs',
            "<cmd>lua require('telescope.builtin').find_files({search_file='*.scala', no_ignore = true, file_ignore_patterns = {'%.semanticdb'}, results_title = 'Scala files' })<CR>",
            desc = 'find scala files',
        },
        {
            '<space>fp',
            "<cmd>lua require('telescope.builtin').find_files({search_file='*.proto', results_title = 'Protobuf files'})<CR>",
            desc = 'find proto files',
        },
        {
            '<space>fl',
            "<cmd>lua require('telescope.builtin').find_files({search_file='*.lua', results_title = 'Lua files'})<CR>",
            desc = 'find lua files',
        },
        {
            '<space>fz',
            "<cmd>lua require('telescope.builtin').find_files({search_file='*.zig', results_title = 'Zig files'})<CR>",
            desc = 'find zig files',
        },
        {
            '<space>e',
            "<cmd>lua require('telescope.builtin').buffers({sort_mru=true, sort_lastused=true})<cr>",
            desc = 'find buffers',
        },
        {
            '<space>o',
            "<cmd>lua require('telescope.builtin').oldfiles()<cr>",
            desc = 'find recent files',
        },
        {
            '<space>h',
            "<cmd>lua require('telescope.builtin').help_tags()<cr>",
            desc = 'search in help',
        },
        {
            '<space>m',
            "<cmd>lua require('telescope.builtin').marks({path_display={'shorten'}})<cr>",
            desc = 'find marks',
        },
        {
            '<space>H',
            "<cmd>lua require('telescope.builtin').highlights()<cr>",
            desc = 'show highlights',
        },
        {
            '<space>r',
            "<cmd>lua require('telescope.builtin').registers()<cr>",
            desc = 'show registers content',
        },
        {
            '<space>gg',
            -- "<cmd>lua require('telescope.builtin').live_grep({additional_args={'--hidden'}})<CR>",
            '<cmd>lua require("telescope").extensions.live_grep_args.live_grep_args({additional_args={"--hidden"}})<CR>',
            desc = 'live grep',
        },
        {
            '<space>gb',
            "<cmd>lua require('telescope.builtin').live_grep({grep_open_files=true,prompt_title = 'Live grep in buffers' })<CR>",
            desc = 'live grep',
        },
        {
            '<space>ff',
            "<cmd>lua require('telescope.builtin').current_buffer_fuzzy_find()<CR>",
            desc = 'find in buffer',
        },
        {
            '<leader>m',
            '<cmd>Telescope metals commands<CR>',
            desc = 'find metals commands',
        },
        {
            '<space>ss',
            "<cmd>lua require('telescope.builtin').lsp_document_symbols()<CR>",
            desc = 'lists LSP document symbols in the current buffer',
        },
        {
            '<space>sm',
            "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols={'method', 'function'}})<CR>",
            desc = 'find method',
        },
        {
            '<space>sf',
            "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='field'})<CR>",
            desc = 'find field',
        },
        {
            '<space>sc',
            "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='class'})<CR>",
            desc = 'find class',
        },
        {
            '<space>si',
            "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='interface'})<CR>",
            desc = 'find interface',
        },
        {
            '<space>wd',
            "<cmd>lua require('telescope.builtin').diagnostics({ severity_limit = 'ERROR'})<CR>",
            desc = 'lists LSP diagnostics for the current workspace if supported, otherwise searches in all open buffers',
        },
        {
            '<space>fg',
            "<cmd>lua require('telescope.builtin').git_status()<CR>",
            desc = 'lists current changes per file with diff preview and add action.',
        },
        {
            'zs',
            "<cmd>lua require('telescope.builtin').spell_suggest()<CR>",
            desc = 'spell suggest',
        },
        {
            '<space>t',
            "<cmd>lua require('telescope.builtin').treesitter()<CR>",
            desc = 'treesitter',
        },
        {
            '<space>lh',
            '<cmd>Telescope undo<cr>',
            desc = 'Undo history',
        },
    },
}
