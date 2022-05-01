local M = {}

require('nvim-treesitter.configs').setup({
    ensure_installed = { 'bash', 'lua', 'vim', 'scala' }, -- one of "all", "maintained" (parsers with maintainers), or a list of languages
    ignore_install = {}, -- List of parsers to ignore installing
    highlight = {
        enable = true, -- false will disable the whole extension
        disable = {}, -- list of language that will be disabled
        -- Setting this to true will run `:h syntax` and tree-sitter at the same time.
        -- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
        -- Using this option may slow down your editor, and you may see some duplicate highlights.
        -- Instead of true it can also be a list of languages
        additional_vim_regex_highlighting = false,
    },
    indent = {
        enable = true,
    },
    textobjects = {
        select = {
            enable = true,

            -- Automatically jump forward to textobj, similar to targets.vim
            lookahead = true,

            keymaps = {
                -- You can use the capture groups defined in textobjects.scm
                ['af'] = '@function.outer',
                ['if'] = '@function.inner',
                ['ac'] = '@class.outer',
                ['ic'] = '@class.inner',
            },
        },
        swap = {
            enable = true,
            swap_next = {
                ['<space>swa'] = '@parameter.inner',
            },
            swap_previous = {
                ['<space>swA'] = '@parameter.inner',
            },
        },
    },
})

vim.cmd([[augroup luatreesitter]])
vim.cmd([[autocmd!]])
vim.cmd([[autocmd FileType lua lua require("conf.treesitter").fold()]])
vim.cmd([[augroup end]])

M.fold = function()
    vim.o.foldmethod = 'expr'
    vim.o.foldexpr = 'nvim_treesitter#foldexpr()'
end

return M
