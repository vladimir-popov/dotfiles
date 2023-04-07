return {
    -- replace selected
    {
        'vladimir-popov/vim-replace',
        lazy = false
    },
    -- autosave
    {
        'Pocco81/auto-save.nvim',
        lazy = false,
        config = true,
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
        ft = { 'lua', 'vim', 'scala', 'c' },
        config = true,
    },
    -- show indents
    {
        'lukas-reineke/indent-blankline.nvim',
        event = 'VeryLazy',
    },
    -- Hop is similar to EasyMotion
    {
        'phaazon/hop.nvim',
        branch = 'v2',
        keys = {
            { 'gw', '<cmd>HopWord<cr>' },
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
            { '<c-b>', '<cmd>NnnPicker %:p:h<cr>' },
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
            'DiffviewFileHistory'
        }
    },
    -- koka lang
    { 'Nymphium/vim-koka', lazy = false },
}
