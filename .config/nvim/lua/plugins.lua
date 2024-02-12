return {
    -- show marks in the signcolumn
    { 'yaocccc/vim-showmarks', lazy = false },
    -- replace selected
    {
        'vladimir-popov/vim-replace',
        lazy = false,
    },
    -- better quick list
    {
        'kevinhwang91/nvim-bqf',
        ft = 'qf',
    },
    -- autosave
    {
        'Pocco81/auto-save.nvim',
        lazy = false,
        config = true,
        enabled = true,
    },
    -- undotree
    {
        'mbbill/undotree',
        config = function()
            vim.g.undotree_WindowLayout = 2
            vim.g.undotree_SetFocusWhenToggle = 1
        end,
        cmd = { 'UndotreeToggle' },
        keys = {
            { '<leader>lh', '<cmd>UndotreeToggle<cr>' },
        },
    },
    -- surround
    {
        'kylechui/nvim-surround',
        lazy = false,
        version = '*',
        config = true,
    },
    -- Comments
    {
        'numToStr/Comment.nvim',
        ft = { 'lua', 'vim', 'scala', 'c', 'cpp', 'make', 'sh', 'java', 'zig' },
        opts = {
            toggler = {
                ---Line-comment toggle keymap
                line = 'gcc',
                ---Block-comment toggle keymap
                block = 'gcb',
            },
            ---LHS of operator-pending mappings in NORMAL and VISUAL mode
            opleader = {
                ---Line-comment keymap
                line = 'gcc',
                ---Block-comment keymap
                block = 'gcb',
            },
        },
    },
    -- show indents
    {
        'lukas-reineke/indent-blankline.nvim',
        event = 'VeryLazy',
        main = 'ibl',
        opts = {
            scope = {
                enabled = false,
            },
        },
    },
    -- Modern fold
    {
        'kevinhwang91/nvim-ufo',
        dependencies = 'kevinhwang91/promise-async',
        enabled = false,
        config = function()
            -- Tell the server the capability of foldingRange,
            -- Neovim hasn't added foldingRange to default capabilities, users must add it manually
            local capabilities = vim.lsp.protocol.make_client_capabilities()
            capabilities.textDocument.foldingRange = {
                dynamicRegistration = false,
                lineFoldingOnly = true,
            }
            local language_servers = require('lspconfig').util.available_servers() -- or list servers manually like {'gopls', 'clangd'}
            for _, ls in ipairs(language_servers) do
                require('lspconfig')[ls].setup({
                    capabilities = capabilities,
                    -- you can add other fields for setting up lsp server in this table
                })
            end
            return {
                provider_selector = function(bufnr, filetype, buftype)
                    return { 'treesitter', 'indent' }
                end,
            }
        end,
    },
    -- Hop is similar to EasyMotion
    {
        'phaazon/hop.nvim',
        branch = 'v2',
        keys = {
            { 'gw',              '<cmd>HopWord<cr>' },
            { '<space><space>b', '<cmd>HopWordBC<cr>' },
            { '<space><space>w', '<cmd>HopWordAC<cr>' },
        },
        config = true,
    },
    -- nnn
    {
        'mcchrish/nnn.vim',
        keys = {
            { '<c-n>', '<cmd>NnnPicker<cr>' },
            { '<c-f>', '<cmd>NnnPicker %:p:h<cr>' },
        },
        config = function()
            vim.g['nnn#session'] = 'local'
        end,
    },
    -- lazygit
    {
        'kdheepak/lazygit.nvim',
        keys = { { '<leader>lg', '<cmd>LazyGit<cr>', desc = 'Run LazyGit' } },
    },
    -- trouble.nvim
    {
        'folke/trouble.nvim',
        config = true,
        enabled = false,
    },
    -- Colorize
    {
        'uga-rosa/ccc.nvim',
        cmd = { 'CccPick', 'CccConvert', 'CccHighlighterToggle' },
    },
    -- diffview
    {
        'sindrets/diffview.nvim',
        dependencies = 'nvim-lua/plenary.nvim',
        opts = {
            view = {
                merge_tool = {
                    layout = 'diff3_horizontal',
                },
            },
            file_panel = {
                listing_style = 'tree', -- One of 'list' or 'tree'
            },
        },
        cmd = {
            'DiffviewOpen',
            'DiffviewToggleFiles',
            'DiffviewFileHistory',
        },
        keys = {
            {
                '<space>gh',
                '<cmd>DiffviewFileHistory %<cr>',
                desc = 'show git history of the current file',
            },
            {
                '<space>gh',
                ":'<,'>DiffviewFileHistory %<cr>",
                desc = 'show git history of the select text',
                mode = 'v',
            },
        },
    },
    -- Markdown Preview
    {
        'iamcco/markdown-preview.nvim',
        build = function()
            vim.fn['mkdp#util#install']()
        end,
        cmd = { 'MarkdownPreview' },
        config = function()
            vim.cmd([[
            let g:mkdp_auto_close = 0
        ]])
        end,
    },
    -- Switch projects
    {
        'ahmedkhalf/project.nvim',
        config = function()
            require('project_nvim').setup({})
            require('telescope').load_extension('projects')
        end,
        dependencies = { 'nvim-telescope/telescope.nvim' },
        cmd = { 'ProjectRoot' },
        keys = {
            {
                '<space>pc',
                ':ProjectRoot<cr>',
                desc = 'Set cwd to the project root',
            },
            {
                '<space>pp',
                ":lua require'telescope'.extensions.projects.projects()<cr>",
                desc = 'Run Telescope with list of projects',
            },
        },
    },
    -- koka lang
    { 'Nymphium/vim-koka',     lazy = false },
}
