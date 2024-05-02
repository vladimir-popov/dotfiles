return {
    { 'Th3Whit3Wolf/one-nvim',  name = 'one-nvim',  event = 'VeryLazy' },
    { 'sainnhe/edge',           event = 'VeryLazy' },
    { 'EdenEast/nightfox.nvim', name = ' nightfox', event = 'VeryLazy' },
    {
        'catppuccin/nvim',
        name = 'catppuccin',
        event = 'VeryLazy',
        config = function()
            vim.g.catppuccin_flavour = 'mocha'
            require('catppuccin').setup({
                no_underline = true,
                background = {
                    light = 'latte',
                    dark = 'mocha',
                },
                custom_highlights = {
                    LspReferenceRead = { bg = '#374b7e' },
                    LspReferenceText = { bg = '#374b7e' },
                    LspReferenceWrite = { bg = '#374b7e' },
                },
            })
        end,
    },
}
