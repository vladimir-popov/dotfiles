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

		wk.register({
			["qq"] = { ":bp<bar>bd#<CR>", "Close the current buffer" },
			["qt"] = { ":tabclose<CR>", "Close the current tab" },
			["qw"] = { ":close<CR>", "Close the current window" },
			["qQ"] = { ":bd<CR>", "Close the current buffer and window" },
			["QQ"] = { ":bd!<CR>", "Force close the current buffer and window" },
			["qh"] = { ":helpclose<cr>", "Close the help window" },

			["gb"] = { "<C-^>", "Go back" },

            -- Communicate with quickfix
			["qo"] = { ":copen<CR>", "Open quickfix window" },
			["qc"] = { ":cclose<CR>", "Close quickfix window" },
			["[q"] = { ":cprevious<CR>", "Go to previous quickfix item" },
			["]q"] = { ":cnext<CR>", "Go to next quickfix item" },

			-- hotkeys to swap between buffers
			["[b"] = { ":bprevious<CR>", "Go to previous buffer" },
			["]b"] = { ":bnext<CR>", "Go to next buffer" },

			-- hotkeys to swap between tabs
			["[t"] = { ":tabprevious<CR> ", "Go to  previous tab " },
			["]t"] = { ":tabnext<CR>", "Go to next tab " },

			["j"] = { "gj", "Move cursor down naturally by display" },
			["k"] = { "gk", "move cursor up naturally by display" },

			["<C-p>"] = { '"+p', "past from the clipboard" },

			["Y"] = { "y$", "Yank till the end of line" },

			["<leader>cd"] = {
				":cd %:p:h<cr>:pwd<cr>",
				"Change cwd to the directory with current file",
			},

            ['<space>cf'] = { ":let @+=expand('%:t') | echo @+ .. ' was copied to the clipboard.'<cr>", "Copy file name" },
            ['<space>cp'] = { ":let @+=expand('%:p') | echo @+ .. ' was copied to the clipboard.'<cr>", "Copy full file path" },
            ['<space>cl'] = { ":let @+=fnamemodify(expand('%'), ':~:.') | echo @+ .. ' was copied to the clipboard.'<cr>", "Copy local file path" },

            ['<space>yf'] = { ":let @\"=expand('%:t') | echo @\" .. ' was copied to the register \".'<cr>", "Yank file name" },
            ['<space>yp'] = { ":let @\"=expand('%:p') | echo @\" .. ' was copied to the register \".'<cr>", "Yank full file path" },
            ['<space>yl'] = { ":let @\"=fnamemodify(expand('%'), ':~:.') | echo @\" .. ' was copied to the register \".'<cr>", "Yank local file path" },

			["<F1>"] = { "K", "" },
			["<F2>"] = { ":set wrap!<bar>set linebreak!<CR>", "Toggle the wrapping a text" },
			["<F3>"] = { ":set hlsearch!<CR>", "Toggle search highlighting" },
			["<F4>"] = { ":Lazy<cr>", "Run Lazy UI" },
			["<F5>"] = { ":so % <bar> echo 'script has been invoked' <CR>", "Run current script" },
		})
		wk.register({
			["<C-c>"] = { '"+y', "copy to the clipboard" },
		}, { mode = "v" })
		-- indent block without loosing selection
		wk.register({
			["<"] = { "<gv" },
			[">"] = { ">gv" },
		}, { mode = "x" })
	end,
}
