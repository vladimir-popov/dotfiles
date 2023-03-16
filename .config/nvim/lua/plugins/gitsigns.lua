return {
    'lewis6991/gitsigns.nvim',
    event = 'VeryLazy',
    config = function()
        local gs = require('gitsigns')
        gs.setup({
            on_attach = function(bufnr)
                local wk = require('which-key')
                wk.register({
                    ['<leader>hs'] = { 'Gitsigns stage_hunk<CR>', 'Stage the hunk' },
                    ['<leader>hu'] = { 'Gitsigns reset_hunk<CR>', 'Reset the hunk' },
                    ['[h'] = { gs.prev_hunk, 'Go to the previous hunk' },
                    [']h'] = { gs.next_hunk, 'Go to the next hunk' },
                    ['<leader>hp'] = { gs.preview_hunk, 'Preview the hunk' },
                    ['<leader>hb'] = {
                        function()
                            gs.blame_line({ full = true })
                        end,
                        'Show git blame',
                    },
                    ['<leader>tb'] = {
                        gs.toggle_current_line_blame,
                        'Show git blame for the current line',
                    },
                    ['<leader>hd'] = { gs.diffthis, 'Show changes' },
                }, { buffer = bufnr })
            end,
            signs = {
                add = { text = '+' },
                change = { text = '~' },
                delete = { text = '_' },
                untracked = { text = '?' },
            },
        })
    end,
}
