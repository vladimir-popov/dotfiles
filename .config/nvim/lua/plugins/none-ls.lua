local zig = function(null_ls, h)
    return {
        name = 'zig',
        method = null_ls.methods.DIAGNOSTICS,
        filetypes = { 'zig' },
        -- null_ls.generator creates an async source
        -- that spawns the command with the given arguments and options
        generator = null_ls.generator({
            command = 'zig',
            args = { 'build-exe', '$FILENAME' },
            to_temp_file = true,
            to_stdin = false,
            from_stderr = true,
            check_exit_code = function(code)
                return code >= 1
            end,
            format = 'line',
            on_output = h.diagnostics.from_patterns({
                {
                    pattern = [[([%w\.]+):(%d+):(%d+): error: (.*)]],
                    groups = { 'filename', 'row', 'col', 'message' },
                    {
                        severities = {
                            error = h.diagnostics.severities['error'],
                            note = h.diagnostics.severities['information'],
                        },
                    },
                },
            }),
        }),
        factory = h.generator_factory,
    }
end

local on_attach = require('lsp_on_attach')
return {
    'nvimtools/none-ls.nvim',
    dependencies = {
        { 'nvim-lua/plenary.nvim' },
    },
    event = 'VeryLazy',
    config = function()
        local null_ls = require('null-ls')
        local helpers = require('null-ls.helpers')
        null_ls.setup({
            debug = true,
            sources = {
                -- null_ls.builtins.code_actions.gitsigns,
                null_ls.builtins.diagnostics.protolint,
                null_ls.builtins.diagnostics.zsh.with({
                    filetypes = { 'sh', 'zsh' },
                }),
                null_ls.builtins.formatting.jq,
                null_ls.builtins.formatting.protolint,
                null_ls.builtins.formatting.stylua.with({
                    extra_args = { '--config-path', vim.fn.expand('~/.stylua.default') },
                }),
            },
            on_attach = on_attach,
        })
    end,
}
