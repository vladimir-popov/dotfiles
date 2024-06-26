return {
    { 'Th3Whit3Wolf/one-nvim',  name = 'one-nvim',  event = 'VeryLazy' },
    { 'sainnhe/edge',           event = 'VeryLazy' },
    { 'EdenEast/nightfox.nvim', name = ' nightfox', event = 'VeryLazy' },
    {
        'catppuccin/nvim',
        name = 'catppuccin',
        lazy = false,
        priority = 1000,
        config = function()
            require('catppuccin').setup({
                flavour = vim.env.CATPPUCCIN or 'macchiato',
                no_underline = true,
                background = {
                    light = 'latte',
                    dark = 'macchiato',
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
