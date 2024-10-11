return {
    'rmagatti/goto-preview',
    ft = { 'lua', 'vim', 'sh', 'yaml', 'c', 'cpp', 'proto', 'python', 'scala' },
    config = {
        zindex = 51,
        post_open_hook = function(buf, win)
            local orig_state = vim.api.nvim_buf_get_option(buf, 'modifiable')
            vim.api.nvim_buf_set_option(buf, 'modifiable', false)
            vim.api.nvim_create_autocmd({ 'WinLeave' }, {
                buffer = buf,
                callback = function()
                    vim.api.nvim_win_close(win, false)
                    vim.api.nvim_buf_set_option(buf, 'modifiable', orig_state)
                    return true
                end,
            })
        end,
    },
    keys = {
        {
            '<space>pd',
            '<cmd>lua require("goto-preview").goto_preview_definition()<CR>',
            desc = 'Preview definition',
        },
        {
            '<space>pt',
            '<cmd>lua require("goto-preview").goto_preview_type_definition()<CR>',
            desc = 'Preview type definition',
        },
        {
            '<space>pi',
            '<cmd>lua require("goto-preview").goto_preview_implementation()<CR>',
            desc = 'Preview imnplementation',
        },
        {
            '<space>pD',
            '<cmd>lua require("goto-preview").goto_preview_declaration()<CR>',
            desc = 'Preview declaration',
        },
        {
            '<space>P',
            '<cmd>lua require("goto-preview").close_all_win()<CR>',
            desc = 'Preview declaration',
        },
    },
}
