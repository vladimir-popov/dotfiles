local on_attach = require('lsp_on_attach')
-- local capabilities = require('blink.cmp').get_lsp_capabilities(
--     require('cmp_nvim_lsp').default_capabilities()
-- )
local capabilities = 
    require('cmp_nvim_lsp').default_capabilities()

return {
    'neovim/nvim-lspconfig',
    dependencies = {
        { 'nvimdev/lspsaga.nvim' },
        { 'ray-x/lsp_signature.nvim' },
        { 'folke/neodev.nvim' },
    },
    ft = { 'lua', 'vim', 'sh', 'yaml', 'c', 'cpp', --[[ 'proto', ]] 'python', 'zig' },
    keys = {
        { '<leader>[', ':LspInfo<cr>', desc = 'Show status of LSP clients' },
    },
    config = function()
        -- require('neodev').setup({})
        local nvim_lsp = require('lspconfig')
        local util = require('lspconfig.util')

        -- LUA -----------------------------------------------------
        nvim_lsp.lua_ls.setup({
            on_attach = on_attach,
            capabilities = capabilities,
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
                        checkThirdParty = false,
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
            capabilities = capabilities,
        })

        -- JavaScript ----------------------------------------------
        nvim_lsp.jsonls.setup({
            on_attach = on_attach,
            capabilities = capabilities,
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
            capabilities = capabilities,
            filetypes = { 'yaml' },
        })

        -- C -------------------------------------------------------
        nvim_lsp.clangd.setup({
            on_attach = on_attach,
            filetypes = { 'c', 'cpp', 'objc', 'objcpp', 'cuda' },
            capabilities = capabilities,
        })

        -- Zig -----------------------------------------------------
        nvim_lsp.zls.setup({
            on_attach = on_attach,
            capabilities = capabilities,
        })

        -- Protobuf-------------------------------------------------
        -- nvim_lsp.bufls.setup({
        --     on_attach = on_attach,
        --     capabilities = capabilities,
        --     root_dir = util.root_pattern('buf.work.yaml', '.git'),
        -- })

        -- Python --------------------------------------------------
        nvim_lsp.pylyzer.setup({
            on_attach = on_attach,
            capabilities = capabilities,
            root_dir = function(fname)
                local root_files = {
                    'setup.py',
                    'tox.ini',
                    'requirements.txt',
                    'Pipfile',
                    'pyproject.toml',
                }
                return util.root_pattern(unpack(root_files))(fname)
                    or util.find_git_ancestor(fname)
                    or vim.fn.getcwd()
            end,
        })
    end,
}
