return {
    'folke/zen-mode.nvim',
    cmd = 'ZenMode',
    keys = {
        {
            '<leader><leader>',
            '<cmd>ZenMode<cr>',
            desc = 'Toggle Zen mode',
        },
    },
    opts = {
        window = {
            backdrop = .8,
            -- height and width can be:
            -- * an absolute number of cells when > 1
            -- * a percentage of the width / height of the editor when <= 1
            -- * a function that returns the width or the height
            width = 130, -- width of the Zen window
            height = 1, -- height of the Zen window
            options = {
                -- by default, no options are changed for the Zen window
                -- add other vim.wo options you want to apply
            },
        },
        plugins = {
            options = {
                enabled = true,
                ruler = false, -- the ruler text in the cmd line area
                showcmd = true, -- the command in the last line of the screen
                -- zenmode will show the statusline only if 'laststatus' == 3
                -- laststatus = 0, -- turn off the statusline in zenmode
            },
            twilight = { enabled = false },
            gitsigns = { enabled = false }, -- it looks like a bug, because `true` disables the gitsigns
        },
    },
}
