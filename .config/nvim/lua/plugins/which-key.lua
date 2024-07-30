return {
    "folke/which-key.nvim",
    lazy = false,
    config = function()
        require("which-key").setup({
            plugins = {
                marks = true,
                registers = false,
                spelling = {
                    enabled = true,
                    suggestions = 10,
                },
            },
        })
        local wk = require("which-key")
        -- wk.register({
        -- 	["'"] = { "`", "Use ' to go to a marked position" },
        -- 	["`"] = { "'", "Use ` to go to a marked line" },
        -- }, { mode = "" })

        wk.add({
            {
                "qq",
                ":bp<bar>bd#<CR>",
                desc = "Close the current buffer"
            },
            {
                "qt",
                ":tabclose<CR>",
                desc = "Close the current tab"
            },
            {
                "qw",
                ":close<CR>",
                desc = "Close the current window"
            },
            {
                "qQ",
                ":bd<CR>",
                desc = "Close the current buffer and window"
            },
            {
                "QQ",
                ":bd!<CR>",
                desc = "Force close the current buffer and window"
            },
            {
                "qh",
                ":helpclose<cr>",
                desc = "Close the help window"
            },
            {
                "gb",
                "<C-^>",
                desc = "Go back"
            },

            -- Communicate with quickfix
            {
                "qo",
                ":copen<CR>",
                desc = "Open quickfix window"
            },
            {
                "qc",
                ":cclose<CR>",
                desc = "Close quickfix window"
            },
            {
                "[q",
                ":cprevious<CR>",
                desc = "Go to previous quickfix item"
            },
            {
                "]q",
                ":cnext<CR>",
                desc = "Go to next quickfix item"
            },

            -- hotkeys to swap between buffers
            {
                "[b",
                ":bprevious<CR>",
                desc = "Go to previous buffer"
            },
            {
                "]b",
                ":bnext<CR>",
                desc = "Go to next buffer"
            },

            -- hotkeys to swap between tabs
            {
                "[t",
                ":tabprevious<CR> ",
                desc = "Go to  previous tab "
            },
            {
                "]t",
                ":tabnext<CR>",
                desc = "Go to next tab "
            },
            {
                "j",
                "gj",
                desc = "Move cursor down naturally by display"
            },
            {
                "k",
                "gk",
                desc = "move cursor up naturally by display"
            },
            {
                "Y",
                "y$",
                desc = "Yank till the end of line"
            },
            {
                "<leader>cd",
                ":cd %:p:h<cr>:pwd<cr>",
                desc = "Change cwd to the directory with current file",
            },
            {
                '<space>cf',
                ":let @+=expand('%:t') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy file name"
            },
            {
                '<space>cp',
                ":let @+=expand('%:p') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy full file path"
            },
            {
                '<space>cl',
                ":let @+=fnamemodify(expand('%'), ':~:.') | echo @+ .. ' was copied to the clipboard.'<cr>",
                desc = "Copy local file path"
            },
            {
                '<space>yf',
                ":let @\"=expand('%:t') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank file name"
            },
            {
                '<space>yp',
                ":let @\"=expand('%:p') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank full file path"
            },
            {
                '<space>yl',
                ":let @\"=fnamemodify(expand('%'), ':~:.') | echo @\" .. ' was copied to the register \".'<cr>",
                desc = "Yank local file path"
            },
            {
                "<F1>",
                "K",
            },
            {
                "<F2>",
                ":set wrap!<bar>set linebreak!<CR>",
                desc = "Toggle the wrapping a text"
            },
            {
                "<F3>",
                ":set hlsearch!<CR>",
                desc = "Toggle search highlighting"
            },
            {
                "<F4>",
                ":Lazy<cr>",
                desc = "Run Lazy UI"
            },
            {
                "<F5>",
                ":so % <bar> echo 'script has been invoked' <CR>",
                desc = "Run current script"
            },
            -- Visual mode
            {
                "<C-c>",
                '"+y',
                desc = "copy to the clipboard",
                mode =
                "v"
            },
            -- indent block without loosing selection
            {
                "<",
                "<gv",
                mode =
                "x"
            },
            {
                ">",
                ">gv",
                mode =
                "x"
            },
        })
    end,
}
