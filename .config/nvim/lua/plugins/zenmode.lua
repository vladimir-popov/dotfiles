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
            backdrop = 1,
            -- height and width can be:
            -- * an absolute number of cells when > 1
            -- * a percentage of the width / height of the editor when <= 1
            -- * a function that returns the width or the height
            width = 140, -- width of the Zen window
            height = 1, -- height of the Zen window
            options = {
                signcolumn = 'yes',
                foldcolumn = '3',
                cursorline = true,
            },
        },
        plugins = {
            options = {
                enabled = true,
                ruler = false, -- the ruler text in the cmd line area
                showcmd = true, -- the command in the last line of the screen
            },
            twilight = { enabled = false },
            gitsigns = { enabled = true },
        },
    },
}
