------------------------------------------------------------
-- LSP (Language Server Protocol)
------------------------------------------------------------
local M = {}
local nvim_lsp = require('lspconfig')

-- Required for proper symbol highlighting
M.highlight_setup = function()
    vim.cmd([[hi! link LspReferenceText CursorColumn]])
    vim.cmd([[hi! link LspReferenceRead CursorColumn]])
    vim.cmd([[hi! link LspReferenceWrite CursorColumn]])
    vim.cmd([[autocmd CursorHold  <buffer> lua vim.lsp.buf.document_highlight()]])
    vim.cmd([[autocmd CursorHoldI <buffer> lua vim.lsp.buf.document_highlight()]])
    vim.cmd([[autocmd CursorMoved <buffer> lua vim.lsp.buf.clear_references()]])
end

-- check LSP client
require('utils').nmap('<leader>[', '<cmd>LspInfo<CR>')
-- run Metals doctor
-- require'utils'.nmap('<leader>]', '<cmd>MetalsRunDoctor<CR>')
require('utils').nmap('<leader>]', '<cmd>lua require("conf/metals").toggle_doctor()<cr>')

-- buffer local keys mapping
function M.keys_mapping(bufnr)
    local function nmap(...)
        require('utils').b.nmap(bufnr, ...)
    end
    local function imap(...)
        require('utils').b.imap(bufnr, ...)
    end
    local function vmap(...)
        require('utils').b.vmap(bufnr, ...)
    end

    -- go to definition
    nmap('gd', '<cmd>lua vim.lsp.buf.definition()<CR>')
    -- go to implementation
    nmap('gi', '<cmd>lua vim.lsp.buf.implementation()<CR>')
    -- show all places where the symbol under cursor is used
    nmap('gr', '<cmd>lua vim.lsp.buf.references()<CR>')
    -- show place where type is defined
    nmap('gt', '<cmd>lua vim.lsp.buf.type_definition()<CR>')
    -- show description of the symbol under cursor
    -- nmap('K', '<cmd>lua vim.lsp.buf.hover()<CR>')
    nmap('K', "<cmd>lua require('lspsaga.signaturehelp').signature_help()<CR>")
    -- show type of selected code
    vmap('K', "<Esc><cmd>lua require('metals').type_of_range()<CR>")
    -- show signature of current method
    nmap('<c-p>', '<cmd>lua vim.lsp.buf.signature_help()<CR>')
    imap('<c-p>', '<cmd>lua vim.lsp.buf.signature_help()<CR>')
    -- open a new window with a list of code-entities in the current document
    nmap('<leader>p', '<cmd>lua vim.lsp.buf.document_symbol()<CR>')
    -- format current buffer
    nmap('<leader>f', '<cmd>lua vim.lsp.buf.formatting()<CR>')
    -- rename the symbol under cursor
    -- nmap('<space>rn', "<cmd>lua require('lspsaga.rename').rename()<CR>")
    nmap('<space>rn', "<cmd>lua vim.lsp.buf.rename()<CR>")
    -- show all possible actions
    -- nmap('<space>qf', '<cmd>lua vim.lsp.buf.code_action()<CR>')
    nmap('<space>qf', '<cmd>lua require("lspsaga.codeaction").code_action()<CR>')
    vmap('<space>qf', '<cmd>lua require("lspsaga.codeaction").code_action()<CR>')
    -- go to error before cursor
    nmap('[e', '<cmd>lua vim.diagnostic.goto_prev({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>')
    nmap('[E', '<cmd>lua vim.diagnostic.goto_prev({ severity={min=vim.diagnostic.severity.INFO} })<CR>')
    -- go to error after cursor
    nmap(']e', '<cmd>lua vim.diagnostic.goto_next({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>')
    nmap(']E', '<cmd>lua vim.diagnostic.goto_next({ severity={min=vim.diagnostic.severity.INFO} })<CR>')
    -- show current buffer in the tree view
    nmap('<leader>tr', '<cmd>lua require"metals.tvp".reveal_in_tree()<CR>')
    -- toggle the tree view
    nmap('<leader>tt', '<cmd>lua require"metals.tvp".toggle_tree_view()<CR>')

    -- DAP
    nmap('<leader>dc', '<cmd>lua require"dap".continue()<CR>')
    nmap('<leader>dl', '<cmd>lua require"dap".run_last()<CR>')
    nmap('<leader>dr', '<cmd>lua require"dap".repl.toggle()<CR>')
    nmap('<leader>ds', '<cmd>lua require"dap.ui.variables").scopes()<CR>')
    nmap('<leader>dt', '<cmd>lua require"dap".toggle_breakpoint()<CR>')
    nmap('<leader>do', '<cmd>lua require"dap".step_over()<CR>')
    nmap('<leader>di', '<cmd>lua require"dap".step_into()<CR>')
    nmap('<leader>du', '<cmd>lua require"dap".step_out()<CR>')
    nmap('<leader>dst', '<cmd>lua require"dap".stop()<CR>')
end

-- DAP -----------------------------------------------------
vim.fn.sign_define('DapBreakpoint', { text = '', texthl = '', linehl = '', numhl = '' })

-- VimScript -----------------------------------------------
nvim_lsp.vimls.setup({
    cmd = { 'vim-language-server', '--stdio' },
})

-- JavaScript ----------------------------------------------
nvim_lsp.jsonls.setup({
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
    filetypes = { 'yaml' },
})

-- spellcheck
local configs = require('lspconfig.configs')
if not configs.spellcheck then
    configs.spellcheck = {
        default_config = {
            cmd = { '/Users/vladimir/Projects/spellcheck-lsp/target/scala-3.1.0/spellcheck-lsp' },
            filetypes = { 'text' },
            root_dir = nvim_lsp.util.root_pattern('/Users/vladimir/Projects/spellcheck-lsp'),
            settings = {},
        },
    }
end

-- Setup ---------------------------------------------------
local servers = { 'bashls', 'vimls', 'jsonls', 'yamlls', 'spellcheck' }

function M.on_attach(client, bufnr)
    if client.name ~= 'yamlls' and client.name ~= 'jsonls' and client.name ~= 'spellcheck' then
        M.highlight_setup()
    end
    M.keys_mapping(bufnr)
    require('lsp_signature').on_attach()
end

for _, lsp in ipairs(servers) do
    nvim_lsp[lsp].setup({
        on_attach = M.on_attach,
        flags = {
            debounce_text_changes = 150,
        },
    })
end

return M
