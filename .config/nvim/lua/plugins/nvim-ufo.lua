return {
    'kevinhwang91/nvim-ufo',
    main = 'ufo',
    name = 'ufo',
    dependencies = {
        'kevinhwang91/promise-async',
    },
    keys = {
        {
            'zR',
            function()
                require('ufo').openAllFolds()
            end,
            desc = 'Open all folds by nvim-ufo',
        },
        {
            'zM',
            function()
                require('ufo').closeAllFolds()
            end,
            desc = 'Close all folds by nvim-ufo',
        },
    },
    opts = {
        -- treesitter as a main provider instead
        -- Only depend on `nvim-treesitter/queries/filetype/folds.scm`,
        -- performance and stability are better than `foldmethod=nvim_treesitter#foldexpr()`
        provider_selector = function(bufnr, filetype, buftype)
            return { 'treesitter', 'indent' }
        end,
    },
}
