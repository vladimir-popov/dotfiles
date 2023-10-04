local ignore_patterns = "file_ignore_patterns = { 'target/' }"

return {
	"nvim-telescope/telescope.nvim",
	opts = {
		pickers = {
			find_files = {
				sort_lastused = true,
				theme = "dropdown",
				previewer = false,
				layout_config = { width = 0.9 },
			},
			buffers = {
				-- sort_lastused = true,
				theme = "dropdown",
				sort_lastused = true,
				-- previewer = false,
				path_display = { "smart" },
				layout_strategy = "center",
			},
			oldfiles = {
				sort_lastused = true,
				-- previewer = false,
				path_display = { "smart" },
				theme = "dropdown",
				layout_config = { width = 0.9 },
			},
			help_tags = {
				previewer = false,
				theme = "dropdown",
			},
			lsp_document_symbols = {
				theme = "dropdown",
			},
			lsp_workspace_diagnostics = {
				severity = "error",
			},

			colorscheme = {
				enable_preview = true,
			},
		},
	},
	keys = {
		{
			"<space>;",
			"<cmd>lua require'telescope.builtin'.builtin()<cr>",
			desc = "show all builtin pickers",
		},
		{
			"<space>a",
			"<cmd>lua require('telescope.builtin').find_files({" .. ignore_patterns .. "})<CR>",
			desc = "find files (without hidden and filtered)",
		},
		{
			"<space>A",
			"<cmd>lua require('telescope.builtin').find_files({ hidden = true})<CR>",
			desc = "find all files",
		},
		{
			"<space>~",
			"<cmd>lua require('telescope.builtin').find_files({ hidden = true, search_dirs = { '"
				.. vim.env.HOME
				.. "' }})<CR>",
			desc = "find files in HOME",
		},
		{
			"<space>e",
			"<cmd>lua require('telescope.builtin').buffers()<cr>",
			desc = "find buffers",
		},
		{
			"<space>o",
			"<cmd>lua require('telescope.builtin').oldfiles()<cr>",
			desc = "find recent files",
		},
		{
			"<space>h",
			"<cmd>lua require('telescope.builtin').help_tags()<cr>",
			desc = "search in help",
		},
		{
			"<space>m",
			"<cmd>lua require('telescope.builtin').marks({path_display={'shorten'}})<cr>",
			desc = "find marks",
		},
		{
			"<space>H",
			"<cmd>lua require('telescope.builtin').highlights()<cr>",
			desc = "show highlights",
		},
		{
			"<space>gg",
			"<cmd>lua require('telescope.builtin').live_grep()<CR>",
			desc = "live grep",
		},
		{
			"<space>n",
			"<cmd>lua require('telescope.builtin').lsp_dynamic_workspace_symbols()<CR>",
			desc = "find class",
		},
		-- {
		-- 	"<space>gg",
		-- 	"<cmd>lua require('telescope.builtin').grep_string()<CR>",
		-- 	desc = "use grep to looking for cword",
		-- },
		-- {
		-- 	"<space>gg",
		-- 	"<cmd>lua require('telescope.builtin').grep_string()<CR>",
		-- 	mode = "v",
		-- 	desc = "use grep to looking for selection",
		-- },
		{
			"<leader>m",
			"<cmd>Telescope metals commands<CR>",
			desc = "find metals commands",
		},
		{
			"<space>ss",
			"<cmd>lua require('telescope.builtin').lsp_document_symbols()<CR>",
			desc = "lists LSP document symbols in the current buffer",
		},
		{
			"<space>sm",
			"<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols={'method', 'function'}})<CR>",
			desc = "find method",
		},
		{
			"<space>sf",
			"<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='field'})<CR>",
			desc = "find field",
		},
		{
			"<space>sc",
			"<cmd>lua require('telescope.builtin').lsp_document_symbols({symbols='class'})<CR>",
			desc = "find class",
		},
		{
			"<space>wd",
			"<cmd>lua require('telescope.builtin').diagnostics()<CR>",
			desc = "lists LSP diagnostics for the current workspace if supported, otherwise searches in all open buffers",
		},
		{
			"<space>gb",
			"<cmd>lua require('telescope.builtin').git_branches()<CR>",
			desc = "git branches",
		},
		{
			"<space>gs",
			"<cmd>lua require('telescope.builtin').git_status()<CR>",
			desc = "lists current changes per file with diff preview and add action.",
		},
		{
			"zs",
			"<cmd>lua require('telescope.builtin').spell_suggest()<CR>",
			desc = "spell suggest",
		},
		{
			"<space>t",
			"<cmd>lua require('telescope.builtin').treesitter()<CR>",
			desc = "treesitter",
		},
	},
}
