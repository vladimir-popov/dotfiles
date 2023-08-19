return {
	"nvim-neo-tree/neo-tree.nvim",
	branch = "v2.x",
	keys = {
		{
			"<leader>'",
			":Neotree toggle reveal<cr>",
			desc = "Show the current file in the NeoTree",
		},
		{
			'<leader>"',
			":Neotree toggle reveal_force_cwd<cr>",
			desc = "Show the current file in the NeoTree, and change cwd",
		},
		{
			"\\/",
			":Neotree toggle document_symbols<cr>",
			desc = "Show the symbols in the current document obtained by the LSP",
		},
		{ "<leader>1", ":Neotree toggle focus<cr>", desc = "Show the current file in the Files" },
		{
			"<leader>2",
			":Neotree toggle document_symbols<cr>",
			desc = "Show the symbols in the current document obtained by the LSP",
		},
		{
			"<leader>3",
			":Neotree toggle focus buffers<cr>",
			desc = "Show the current file in the Buffers",
		},
		{
			"<leader>4",
			":Neotree toggle focus git_status<cr>",
			desc = "Show the current file in the Git",
		},
	},
	dependencies = {
		"nvim-lua/plenary.nvim",
		"nvim-tree/nvim-web-devicons",
		"MunifTanjim/nui.nvim",
	},
	config = function()
		vim.fn.sign_define("DiagnosticSignError", { text = " ", texthl = "DiagnosticSignError" })
		vim.fn.sign_define("DiagnosticSignWarn", { text = " ", texthl = "DiagnosticSignWarn" })
		vim.fn.sign_define("DiagnosticSignInfo", { text = " ", texthl = "DiagnosticSignInfo" })
		vim.fn.sign_define("DiagnosticSignHint", { text = "", texthl = "DiagnosticSignHint" })

		require("neo-tree").setup({
			close_if_last_window = true,
			window = {
				position = "left",
				width = 35,
			},
			sources = {
				"filesystem",
				"buffers",
				"git_status",
				"document_symbols",
			},
			source_selector = {
				winbar = true,
				statusline = false,
			},
			default_component_configs = {
				indent = {
					with_expanders = true,
					expander_collapsed = "",
					expander_expanded = "",
					expander_highlight = "NeoTreeExpander",
				},
			},
			filesystem = {
				filtered_items = {
					hide_dotfiles = false,
				},
				-- This will find and focus the file in the active buffer every
				-- time the current file is changed while the tree is open.
				follow_current_file = false,
			},
			document_symbols = {
				kinds = {
					File = { icon = "󰈙", hl = "Tag" },
					Namespace = { icon = "󰌗", hl = "Include" },
					Package = { icon = "󰏖", hl = "Label" },
					Class = { icon = "󰌗", hl = "Include" },
					Property = { icon = "󰆧", hl = "@property" },
					Enum = { icon = "󰒻", hl = "@number" },
					Function = { icon = "󰊕", hl = "Function" },
					String = { icon = "󰀬", hl = "String" },
					Number = { icon = "󰎠", hl = "Number" },
					Array = { icon = "󰅪", hl = "Type" },
					Object = { icon = "󰅩", hl = "Type" },
					Key = { icon = "󰌋", hl = "" },
					Struct = { icon = "󰌗", hl = "Type" },
					Operator = { icon = "󰆕", hl = "Operator" },
					TypeParameter = { icon = "󰊄", hl = "Type" },
					StaticMethod = { icon = "󰠄 ", hl = "Function" },
				},
			},
		})
	end,
}
