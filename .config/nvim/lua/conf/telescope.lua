------------------------------------------------------------
-- Telescope
------------------------------------------------------------
local function nmap(keys, action)
    vim.api.nvim_set_keymap('n', keys, action, { noremap = true, silent = true })
end

require('telescope').setup({
    defaults = {
        mappings = {
            i = {
                ['<esc>'] = require('telescope.actions').close,
            },
        },
    },
    pickers = {
        -- <space>a
        find_files = {
            sort_lastused = true,
            theme = 'dropdown',
            previewer = false,
            -- layout_strategy='horizontal'
        },
        -- <space>w
        buffers = {
            -- sort_lastused = true,
            theme = 'dropdown',
            sort_lastused = true,
            -- previewer = false,
            path_display = { 'smart' },
            layout_strategy = 'center',
        },
        -- <space>o
        oldfiles = {
            sort_lastused = true,
            -- previewer = false,
            path_display = { 'smart' },
            theme = 'dropdown',
        },
        -- <space>h
        help_tags = {
            previewer = false,
            theme = 'dropdown',
        },
        -- <space>r
        registers = {
            theme = 'dropdown',
        },
        -- <space>s
        lsp_document_symbols = {
            theme = 'dropdown',
        },
        -- <space>d
        lsp_workspace_diagnostics = {
            severity = 'error',
        },
    },
})

-- show all builin pickers
nmap('<space>;', "<cmd>lua require'telescope.builtin'.builtin()<cr>")
-- find files
local ignore_patterns = "file_ignore_patterns = { 'target/' }"
nmap(
    '<space>a',
    "<cmd>lua require('telescope.builtin').find_files({" .. ignore_patterns .. '})<CR>'
)
nmap('<space>A', "<cmd>lua require('telescope.builtin').find_files({ hidden = true})<CR>")
nmap(
    '<space>~',
    "<cmd>lua require('telescope.builtin').find_files({ hidden = true, search_dirs = { '"
        .. vim.env.HOME
        .. "' }})<CR>"
)
-- find buffers
nmap('<space>e', "<cmd>lua require('telescope.builtin').buffers()<cr>")
-- find recent files
nmap('<space>o', "<cmd>lua require('telescope.builtin').oldfiles()<cr>")
-- search in help
nmap('<space>h', "<cmd>lua require('telescope.builtin').help_tags()<cr>")
-- find marks
nmap('<space>m', "<cmd>lua require('telescope.builtin').marks({path_display={'shorten'}})<cr>")
-- show highlights
nmap('<space>H', "<cmd>lua require('telescope.builtin').highlights()<cr>")
-- show registers and insert selected content
nmap('<space>r', "<cmd>lua require('telescope.builtin').registers()<cr>")
-- live grep
nmap('<space>gg', "<cmd>lua require('telescope.builtin').live_grep()<CR>")
-- find metals commands
nmap('<leader>m', '<cmd>Telescope metals commands<CR>')
-- lists LSP document symbols in the current buffer
nmap('<space>ss', "<cmd>lua require('telescope.builtin').lsp_document_symbols()<CR>")
nmap(
    '<space>sm',
    "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols={'method', 'function'}})<CR>"
)
nmap(
    '<space>sf',
    "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='field'})<CR>"
)
nmap(
    '<space>sc',
    "<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='class'})<CR>"
)
-- lists LSP diagnostics for the current workspace if supported, otherwise searches in all open buffers
nmap('<space>wd', "<cmd>lua require('telescope.builtin').diagnostics()<CR>")
-- git branches
nmap('<space>gb', "<cmd>lua require('telescope.builtin').git_branches()<CR>")
-- lists current changes per file with diff preview and add action.
nmap('<space>gs', "<cmd>lua require('telescope.builtin').git_status()<CR>")
-- spell suggest
nmap('zs', "<cmd>lua require('telescope.builtin').spell_suggest()<CR>")
-- treesitter
nmap('<space>t', "<cmd>lua require('telescope.builtin').treesitter()<CR>")
