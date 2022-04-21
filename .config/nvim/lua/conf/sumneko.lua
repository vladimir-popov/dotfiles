-- LUA -----------------------------------------------------
local nvim_lsp = require('lspconfig')

-- set the path to the sumneko installation;
local sumneko_root_path = vim.env.HOME .. '/Projects/lua-language-server'
local sumneko_binary = sumneko_root_path .. '/bin/lua-language-server'

local runtime_path = vim.split(package.path, ';')
table.insert(runtime_path, 'lua/?.lua')
table.insert(runtime_path, 'lua/?/init.lua')

local function on_attach(client, bufnr)
    require('conf/setup_lsp').on_attach(client, bufnr)
    require('utils').b.nmap(bufnr, '<leader>f', ':Neoformat<CR>')
    require('utils').b.vmap(bufnr, '<leader>f', ':Neoformat<CR>')
end

nvim_lsp.sumneko_lua.setup({
    cmd = { sumneko_binary, '-E', sumneko_root_path .. '/main.lua' },
    on_attach = on_attach,
    -- see description here https://github.com/sumneko/vscode-lua/blob/master/setting/schema.json
    settings = {
        Lua = {
            runtime = {
                -- Tell the language server which version of Lua you're using (most likely LuaJIT in the case of Neovim)
                version = 'LuaJIT',
                -- Setup your lua path
                path = runtime_path,
            },
            diagnostics = {
                -- Get the language server to recognize the `vim` global
                globals = { 'vim' },
            },
            workspace = {
                -- Make the server aware of Neovim runtime files
                library = vim.api.nvim_get_runtime_file('', true),
            },
            -- Do not send telemetry data containing a randomized but unique identifier
            telemetry = {
                enable = false,
            },
            -- Configuration of the EmmyLuaCodeStyle
            -- ! doesn't work on 04/21/22 !
            format = {
                enable = false,
                -- Put format options here
                -- NOTE: the value should be STRING!!
                defaultConfig = {
                    indent_style = 'space',
                    indent_size = '4',
                },
            },
            IntelliSense = {
                traceLocalSet = true,
            },
        },
    },
})
