return {
    'rmagatti/goto-preview',
    ft = { 'lua', 'vim', 'sh', 'yaml', 'c', 'cpp', 'proto', 'python', 'scala' },
    config = true,
    keys = {
        { '<space>pd', '<cmd>lua require("goto-preview").goto_preview_definition()<CR>', desc = 'Preview definition' },
        { '<space>pt', '<cmd>lua require("goto-preview").goto_preview_type_definition()<CR>', desc = 'Preview type definition' },
        { '<space>pi', '<cmd>lua require("goto-preview").goto_preview_implementation()<CR>', desc = 'Preview imnplementation' },
        { '<space>pD', '<cmd>lua require("goto-preview").goto_preview_declaration()<CR>', desc = 'Preview declaration' },
        { '<space>P', '<cmd>lua require("goto-preview").close_all_win()<CR>', desc = 'Preview declaration' },
    },
}
