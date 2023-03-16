return {
    'L3MON4D3/LuaSnip',
    version = 'v1.*',
    event = 'InsertEnter',
    config = function()
        local ls = require('luasnip')
        ls.setup({
            enable_autosnippets = true,
            store_selection_keys = '<Tab>',
        })
        local path = '~/.config/nvim/lua/snippets'
        require('luasnip.loaders.from_lua').lazy_load({ paths = path })
        vim.keymap.set('n', '<leader>L', function()
            require('luasnip.loaders.from_lua').load({ paths = path })
            print('Snippets have been updated.')
        end)
        vim.keymap.set('n', '<leader>ul', function()
            require('luasnip').unlink_current()
        end)
        vim.cmd(
            [[imap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>']]
        )
        vim.cmd(
            [[smap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>']]
        )
        vim.cmd(
            [[nmap <silent><expr> <C-]> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<C-]>']]
        )
        vim.cmd(
            [[imap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>']]
        )
        vim.cmd(
            [[smap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>']]
        )
        vim.cmd(
            [[nmap <silent><expr> <CR> luasnip#jumpable(1) ? '<Plug>luasnip-jump-next' : '<CR>']]
        )
        vim.cmd(
            [[imap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>']]
        )
        vim.cmd(
            [[smap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>']]
        )
        vim.cmd(
            [[nmap <silent><expr> <C-[> luasnip#jumpable(-1) ? '<Plug>luasnip-jump-prev' : '<C-[>']]
        )
    end,
}
