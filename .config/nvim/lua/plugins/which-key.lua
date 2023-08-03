return {
    'folke/which-key.nvim',
    lazy = false,
    config = function()
        require('which-key').setup({
            plugins = {
                marks = true,
                registers = false,
                spelling = {
                    enabled = true,
                    suggestions = 10,
                },
            },
        })
        local wk = require('which-key')
        -- wk.register({
        -- 	["'"] = { "`", "Use ' to go to a marked position" },
        -- 	["`"] = { "'", "Use ` to go to a marked line" },
        -- }, { mode = "" })

        wk.register({
            ['jj'] = { '<esc>', 'use jj to comeback to the normal mode' },
        }, { mode = 'i' })

        wk.register({
            ['qq'] = { ':bp<bar>bd#<CR>', 'Close the current buffer' },
            ['qw'] = { ':close<CR>', 'Close the current window' },
            ['qQ'] = { ':bd<CR>', 'Close the current buffer and window' },
            ['QQ'] = { ':bd!<CR>', 'Force close the current buffer and window' },
            ['qo'] = { ':copen<CR>', 'Open quickfix window' },
            ['qc'] = { ':cclose<CR>', 'Close quickfix window' },
            ['qh'] = { ':helpclose<cr>', 'Close the help window' },

            ['gb'] = { '<C-^>', 'Go back' },

            -- hotkeys to swap between buffers
            ['[b'] = { ':bprevious<CR>', 'Go to previous buffer' },
            [']b'] = { ':bnext<CR>', 'Go to next buffer' },

            -- hotkeys to swap between tabs
            ['[t'] = { ':tabprevious<CR> ', 'Go to  previous tab ' },
            [']t'] = { ':tabnext<CR>', 'Go to next tab ' },

            ['j'] = { 'gj', 'Move cursor down naturally by display' },
            ['k'] = { 'gk', 'move cursor up naturally by display' },

            ['<C-p>'] = { '"+p', 'past from the clipboard' },

            ['Y'] = { 'y$', 'Yank till the end of line' },

            ['<leader>cd'] = {
                ':cd %:p:h<cr>:pwd<cr>',
                'Change cwd to the directory with current file',
            },

            ['<F1>'] = { 'K', '' },
            ['<F2>'] = { ':set wrap!<bar>set linebreak!<CR>', 'Toggle the wrapping a text' },
            ['<F3>'] = { ':set hlsearch!<CR>', 'Toggle search highlighting' },
            ['<F4>'] = { ':Lazy<cr>', 'Run Lazy UI' },
            ['<F5>'] = { ":so % <bar> echo 'script has been invoked' <CR>", 'Run current script' },
        })
        wk.register({
            ['<C-c>'] = { '"+y', 'copy to the clipboard' },
        }, { mode = 'v' })
        -- indent block without loosing selection
        wk.register({
            ['<'] = { '<gv' },
            ['>'] = { '>gv' },
        }, { mode = 'x' })
    end,
}
