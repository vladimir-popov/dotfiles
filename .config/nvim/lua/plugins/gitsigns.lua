return {
	"lewis6991/gitsigns.nvim",
	event = "VeryLazy",
	config = function()
		local gs = require("gitsigns")
		gs.setup({
			on_attach = function(bufnr)
				local wk = require("which-key")
				wk.register({
					["<leader>hs"] = {
						gs.stage_hunk,
						"Stage the hunk",
					},
					["<leader>hu"] = {
						gs.reset_hunk,
						"Reset the hunk",
					},
					["[h"] = { gs.prev_hunk, "Go to the previous hunk" },
					["]h"] = { gs.next_hunk, "Go to the next hunk" },
					["<leader>hp"] = { gs.preview_hunk, "Preview the hunk" },
					["<leader>hB"] = {
						function()
							gs.blame_line({ full = true })
						end,
						"Show git blame",
					},
					["<leader>hb"] = {
						gs.toggle_current_line_blame,
						"Show git blame for the current line",
					},
					["<leader>hd"] = { gs.diffthis, "Show changes" },
				}, { buffer = bufnr })
				wk.register({
					["<leader>hs"] = {
						function()
							gs.stage_hunk({ vim.fn.line("."), vim.fn.line("v") })
						end,
						"Stage the hunk",
					},
					["<leader>hu"] = {
						function()
							gs.reset_hunk({ vim.fn.line("."), vim.fn.line("v") })
						end,
						"Reset the hunk",
					},
				}, { mode = "v", buffer = bufnr })
			end,
			signs = {
				add = { text = "+" },
				change = { text = "~" },
				delete = { text = "_" },
				untracked = { text = "?" },
			},
		})
	end,
}
