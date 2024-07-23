return {
    -- show marks in the signcolumn
    {
        'chentoast/marks.nvim',
        lazy = false,
        config = true,
    },
    -- replace selected
    {
        'vladimir-popov/vim-replace',
        lazy = false,
    },
    -- better quick list
    {
        'kevinhwang91/nvim-bqf',
        enabled = false,
        ft = 'qf',
        cmd = { 'BqfEnable', 'BqfToggle' },
    },
    -- autosave (my fork with get_autosave_state method)
    {
        'vladimir-popov/auto-save.nvim',
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
            { '<leader>lh', '<cmd>UndotreeToggle \\| Neotree close<cr>' },
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
                enabled = true,
            },
        },
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
        cmd = { 'TroubleToggle' },
        keys = {
            { 'qo', '<cmd>lua require("trouble").open("quickfix")<cr>' },
            { 'qc', '<cmd>lua require("trouble").close()<cr>' },
            { '[q', '<cmd>lua require("trouble").previous({skip_groups = true, jump = true})<cr>' },
            { ']q', '<cmd>lua require("trouble").next({skip_groups = true, jump = true})<cr>' },
        }
    },
    -- Colorize
    {
        'uga-rosa/ccc.nvim',
        config = true,
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
    -- Markdown
    {
        'MeanderingProgrammer/markdown.nvim',
        main = "render-markdown",
        opts = {},
        ft = { 'markdown' },
        cmd = { 'RenderMarkdown' },
        -- dependencies = { 'nvim-treesitter/nvim-treesitter', 'echasnovski/mini.nvim' }, -- if you use the mini.nvim suite
        -- dependencies = { 'nvim-treesitter/nvim-treesitter', 'echasnovski/mini.icons' }, -- if you use standalone mini plugins
        dependencies = { 'nvim-treesitter/nvim-treesitter', 'nvim-tree/nvim-web-devicons' }, -- if you prefer nvim-web-devicons
    },
    {
        'iamcco/markdown-preview.nvim',
        build = function()
            vim.fn['mkdp#util#install']()
        end,
        ft = { 'markdown' },
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
    { 'Nymphium/vim-koka', lazy = false },
    -- PlantUML
    {
        'weirongxu/plantuml-previewer.vim',
        lazy = false,
        dependencies = { 'aklt/plantuml-syntax', 'tyru/open-browser.vim' },
        config = function()
            vim.cmd [[
au FileType plantuml let g:plantuml_previewer#plantuml_jar_path = get(
    \  matchlist(system('cat `which plantuml` | grep plantuml.jar'), '\v.*\s[''"]?(\S+plantuml\.jar).*'),
    \  1,
    \  0
    \)
            ]]
        end
    }
}
