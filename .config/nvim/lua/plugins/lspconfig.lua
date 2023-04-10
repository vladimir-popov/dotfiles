local on_attach = require('lsp_on_attach')

return {
    'neovim/nvim-lspconfig',
    dependencies = {
        { 'tami5/lspsaga.nvim' },
        { 'ray-x/lsp_signature.nvim' },
    },
    ft = { 'lua', 'vim', 'sh', 'yaml', 'c' },
    keys = {
        { '<leader>[', ':LspInfo<cr>', desc = 'Show status of LSP clients' },
    },
    config = function()
        local nvim_lsp = require('lspconfig')

        -- LUA -----------------------------------------------------
        nvim_lsp.lua_ls.setup({
            on_attach = on_attach,
            -- see description here https://github.com/sumneko/vscode-lua/blob/master/setting/schema.json
            settings = {
                Lua = {
                    runtime = {
                        version = 'LuaJIT',
                    },
                    diagnostics = {
                        -- Get the language server to recognize the `vim` global
                        globals = { 'vim' },
                        disable = { 'redefined-local' },
                    },
                    workspace = {
                        -- Make the server aware of Neovim runtime files
                        library = vim.api.nvim_get_runtime_file('', true),
                    },
                    telemetry = { enable = false },
                    IntelliSense = { traceLocalSet = true },
                },
            },
        })

        -- VimScript -----------------------------------------------
        nvim_lsp.vimls.setup({
            cmd = { 'vim-language-server', '--stdio' },
            on_attach = on_attach,
        })

        -- JavaScript ----------------------------------------------
        nvim_lsp.jsonls.setup({
            on_attach = on_attach,
            commands = {
                Format = {
                    function()
                        vim.lsp.buf.range_formatting({}, { 0, 0 }, { vim.fn.line('$'), 0 })
                    end,
                },
            },
        })

        -- YAML ----------------------------------------------------
        nvim_lsp.yamlls.setup({
            cmd = { 'yaml-language-server', '--stdio' },
            on_attach = on_attach,
            filetypes = { 'yaml' },
        })
        -- C -------------------------------------------------------
        nvim_lsp.clangd.setup({
            on_attach = on_attach,
        })
    end,
}
