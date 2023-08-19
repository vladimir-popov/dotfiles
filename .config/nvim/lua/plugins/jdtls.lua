return {
	"mfussenegger/nvim-jdtls",
	dependencies = {
		{ "tami5/lspsaga.nvim" },
		{ "ray-x/lsp_signature.nvim" },
	},
	ft = { "java" },
	enabled = false,
	config = function()
		local jdtlsau = vim.api.nvim_create_augroup("jdtlsau", { clear = true })
		vim.api.nvim_create_autocmd({ "FileType" }, {
			group = jdtlsau,
			pattern = "java",
			callback = function()
				local bufnr = vim.api.nvim_get_current_buf()

				-- Expand TABs to spaces.
				vim.bo[bufnr].expandtab = true

				-- Set the width of a TAB.
				vim.bo[bufnr].tabstop = 4

				-- Indents will have a width of:
				vim.bo[bufnr].shiftwidth = 4

				-- Sets the number of columns for a TAB:
				vim.bo[bufnr].softtabstop = 4

				-- Special for Java key-bindings:
				local wk = require("which-key")
				wk.register({
					["<leader>o"] = {
						':lua require"jdtls".organize_imports()<CR>',
						"organize import in java",
					},
				}, { buffer = bufnr })

				-- Setup jdtls
				require("jdtls").start_or_attach({
					cmd = { "jdtls" },
					root_dir = vim.fn.getcwd(),
					-- default on_attach settings:
					on_attach = require("lsp_on_attach"),
					settings = {
						java = {
							project = {
								referencedLibraries = {
									vim.fn.expand("$HOME/Projects/algorithms-part1/algs4.jar"),
								},
							},
							format = {
								settings = {
									url = "https://raw.githubusercontent.com/google/styleguide/gh-pages/eclipse-java-google-style.xml",
									profile = "GoogleStyle",
								},
							},
						},
					},
				})
			end,
		})
	end,
}
