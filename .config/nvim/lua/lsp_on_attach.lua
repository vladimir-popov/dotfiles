require('lspsaga').setup({
    lightbulb = {
        virtual_text = false
    },
    symbol_in_winbar = {
        enable = true,
    },
    diagnostic = {
        diagnostic_only_current = true
    },
    code_action = {
        keys = {
            quit = '<esc>'
        }
    },
    hover = {
        max_height = 0.95
    }
})

-- turn on boarder for default float windows
local _border = 'single'
-- vim.lsp.handlers['textDocument/hover'] = vim.lsp.with(vim.lsp.handlers.hover, {
--     border = _border,
-- })
--
-- vim.lsp.handlers['textDocument/signatureHelp'] = vim.lsp.with(vim.lsp.handlers.signature_help, {
--     border = _border,
-- })
-- do not show diagnostics in virtual text
vim.diagnostic.config({ virtual_text = false, float = { border = _border } })

-- Required for proper symbol highlighting
local highlight_setup = function(client)
    if client.server_capabilities.documentHighlightProvider then
        vim.cmd([[autocmd CursorHold  <buffer> lua vim.lsp.buf.document_highlight()]])
        vim.cmd([[autocmd CursorHoldI <buffer> lua vim.lsp.buf.document_highlight()]])
        vim.cmd([[autocmd CursorMoved <buffer> lua vim.lsp.buf.clear_references()]])
    end
end

local keys_mapping = function(client, bufnr)
    local wk = require('which-key')
    wk.add({
        {
            '<space>n',
            '<cmd>lua require("telescope.builtin").lsp_dynamic_workspace_symbols()<CR>',
            desc = 'search type in workspace',
            buffer = bufnr
        },
        {
            '<leader>f',
            '<cmd>lua vim.lsp.buf.format()<CR>',
            desc = 'format current buffer',
            buffer = bufnr
        },
        {
            'gd',
            '<cmd>lua require("telescope.builtin").lsp_definitions()<CR>',
            desc = 'go to definition',
            buffer = bufnr
        },
        {
            'gi',
            '<cmd>lua require("telescope.builtin").lsp_implementations()<CR>',
            desc = 'go to implementation',
            buffer = bufnr
        },
        {
            'gr',
            '<cmd>lua require("telescope.builtin").lsp_references()<CR>',
            desc = 'show all places where the symbol under cursor is used',
            buffer = bufnr
        },
        {
            'gt',
            '<cmd>lua vim.lsp.buf.type_definition()<CR>',
            desc = 'show place where type is defined',
            buffer = bufnr
        },
        {
            'K',
            -- '<cmd>Lspsaga hover_doc max_height=0.9<CR>',
            '<cmd>lua vim.lsp.buf.hover({border = "single"})<CR>',
            desc = 'show description of the symbol under cursor',
            buffer = bufnr
        },
        {
            '<c-p>',
            '<cmd>lua vim.lsp.buf.signature_help()<CR>',
            desc = 'show signature of current method',
            buffer = bufnr
        },
        {
            '<leader>p',
            '<cmd>lua vim.lsp.buf.document_symbol()<CR>',
            desc = 'open a new window with a list of code-entities in the current document',
            buffer = bufnr
        },
        {
            '<space>rn',
            '<cmd>lua vim.lsp.buf.rename()<CR>',
            desc = 'rename the symbol under cursor',
            buffer = bufnr
        },
        {
            '<space>qf',
            '<cmd>Lspsaga code_action<CR>',
            -- '<cmd>lua vim.lsp.buf.code_action()<cr>',
            desc = 'show all possible actions',
            buffer = bufnr
        },
        {
            '<space>qf',
            '<cmd>Lspsaga code_action<CR>',
            desc = 'show all possible actions for selected code',
            mode = 'v',
            buffer = bufnr
        },
        {
            '<leader>e',
            string.format(
                '<cmd>lua vim.diagnostic.open_float({ bufnr = %d, scope = "l" })<CR>',
                bufnr
            ),
            desc = 'Show errors on the current line',
            buffer = bufnr
        },
        {
            '[e',
            '<cmd>lua vim.diagnostic.goto_prev({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>',
            desc = 'go to error before cursor',
            buffer = bufnr
        },
        {
            '[E',
            '<cmd>lua vim.diagnostic.goto_prev({ severity={min=vim.diagnostic.severity.INFO} })<CR>',
            desc = 'go to error before cursor and show in float window',
            buffer = bufnr
        },
        {
            ']e',
            '<cmd>lua vim.diagnostic.goto_next({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>',
            desc = 'go to error after cursor',
            buffer = bufnr
        },
        {
            ']E',
            '<cmd>lua vim.diagnostic.goto_next({ severity={min=vim.diagnostic.severity.INFO} })<CR>',
            desc = 'go to error after cursor and show in float window',
            buffer = bufnr
        },
        {
            '<leader>tr',
            '<cmd>lua require"metals.tvp".reveal_in_tree()<CR>',
            desc = 'show current buffer in the tree view',
            buffer = bufnr
        },
        {
            '<leader>tt',
            '<cmd>lua require"metals.tvp".toggle_tree_view()<CR>',
            desc = 'toggle the tree view',
            buffer = bufnr
        },
        {
            '<c-p>',
            '<cmd>lua vim.lsp.buf.signature_help()<CR>',
            desc = 'show signature of current method',
            mode = 'i',
            buffer = bufnr
        },
        {
            'K',
            "<Esc><cmd>lua require('metals').type_of_range()<CR>",
            desc = 'show type of selected code',
            mode = 'v',
            buffer = bufnr
        },
        {
            '<leader>f',
            '<cmd>lua vim.lsp.buf.format()<CR>',
            desc = 'format selected code',
            mode = 'v',
            buffer = bufnr
        },
    })
end

return function(client, bufnr)
    highlight_setup(client)
    keys_mapping(client, bufnr)
    -- require('lsp_signature').on_attach({ bind = true }, bufnr)
end
