local on_attach = require('lsp_on_attach')
return {
    'nvimtools/none-ls.nvim',
    dependencies = {
        { 'nvim-lua/plenary.nvim' },
    },
    event = 'VeryLazy',
    config = function()
        local null_ls = require('null-ls')
        null_ls.setup({
            sources = {
                -- null_ls.builtins.code_actions.gitsigns,
                null_ls.builtins.diagnostics.protolint,
                null_ls.builtins.diagnostics.zsh,
                null_ls.builtins.formatting.protolint,
                null_ls.builtins.formatting.stylua.with({
                    extra_args = { '--config-path', vim.fn.expand('~/.stylua.default') },
                }),
            },
            on_attach = on_attach,
        })
    end,
}
