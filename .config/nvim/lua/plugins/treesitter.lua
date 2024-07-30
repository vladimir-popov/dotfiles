local file_types =
{ 'bash', 'lua', 'luadoc', 'vim', 'vimdoc', 'scala', 'c', 'cpp', 'java', 'proto', 'python', 'markdown', 'zig', 'html' }
return {
    'nvim-treesitter/nvim-treesitter',
    build = ':TSUpdate',
    ft = file_types,
    dependencies = {
        'nvim-treesitter/playground',
        'nvim-treesitter/nvim-treesitter-textobjects',
    },
    config = function()
        require('nvim-treesitter.configs').setup({
            -- one of "all", "maintained" (parsers with maintainers),
            -- or a list of languages
            ensure_installed = { unpack(file_types), 'markdown_inline' },
            ignore_install = {},          -- List of parsers to ignore installing
            highlight = {
                enable = true,            -- false will disable the whole extension
                disable = { 'markdown', 'vimdoc', 'help' }, -- list of language that will be disabled
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
                        ['ab'] = '@block.outer',
                        ['ib'] = '@block.inner',
                        ['af'] = '@function.outer',
                        ['if'] = '@function.inner',
                        ['ac'] = '@comment.outer',
                        ['ic'] = '@comment.inner',
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
    end,
}
