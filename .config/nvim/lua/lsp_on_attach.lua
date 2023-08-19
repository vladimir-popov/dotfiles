-- do not show diagnostics in virtual text
vim.diagnostic.config({ virtual_text = false })

-- Required for proper symbol highlighting
local highlight_setup = function(client)
	if client.name == "yamlls" or client.name == "jsonls" then
		return
	end
	vim.cmd([[autocmd CursorHold  <buffer> lua vim.lsp.buf.document_highlight()]])
	vim.cmd([[autocmd CursorHoldI <buffer> lua vim.lsp.buf.document_highlight()]])
	vim.cmd([[autocmd CursorMoved <buffer> lua vim.lsp.buf.clear_references()]])
end

local keys_mapping = function(client, bufnr)
	local wk = require("which-key")
	wk.register({
		["<leader>f"] = {
			client.name ~= "lua_ls" and "<cmd>lua vim.lsp.buf.format()<CR>"
				or ":silent !stylua --config-path ~/.stylua.default %<cr>",
			"format current buffer",
		},
		["gd"] = {
			"<cmd>lua vim.lsp.buf.definition()<CR>",
			"go to definition",
		},
		["gi"] = {
			"<cmd>lua vim.lsp.buf.implementation()<CR>",
			"go to implementation",
		},
		["gr"] = {
			"<cmd>lua vim.lsp.buf.references()<CR>",
			"show all places where the symbol under cursor is used",
		},
		["gt"] = {
			"<cmd>lua vim.lsp.buf.type_definition()<CR>",
			"show place where type is defined",
		},
		["K"] = {
			"<cmd>lua vim.lsp.buf.hover()<CR>",
			"show description of the symbol under cursor",
		},
		["<c-p>"] = {
			"<cmd>lua vim.lsp.buf.signature_help()<CR>",
			"show signature of current method",
		},
		["<leader>p"] = {
			"<cmd>lua vim.lsp.buf.document_symbol()<CR>",
			"open a new window with a list of code-entities in the current document",
		},
		["<space>rn"] = {
			"<cmd>lua vim.lsp.buf.rename()<CR>",
			-- '<cmd>Lspsaga rename<cr>',
			"rename the symbol under cursor",
		},
		["<space>qf"] = {
			'<cmd>lua require("lspsaga.codeaction").code_action()<CR>',
			"show all possible actions",
		},
		["<leader>e"] = {
			string.format('<cmd>lua vim.diagnostic.open_float({ bufnr = %d, scope = "l" })<CR>', bufnr),
			"Show errors on the current line",
		},
		["[e"] = {
			"<cmd>lua vim.diagnostic.goto_prev({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>",
			"go to error before cursor",
		},
		["[E"] = {
			"<cmd>lua vim.diagnostic.goto_prev({ severity={min=vim.diagnostic.severity.INFO} })<CR>",
			"go to error before cursor and show in float window",
		},
		["]e"] = {
			"<cmd>lua vim.diagnostic.goto_next({ float=false, severity={min=vim.diagnostic.severity.INFO} })<CR>",
			"go to error after cursor",
		},
		["]E"] = {
			"<cmd>lua vim.diagnostic.goto_next({ severity={min=vim.diagnostic.severity.INFO} })<CR>",
			"go to error after cursor and show in float window",
		},
		["<leader>tr"] = {
			'<cmd>lua require"metals.tvp".reveal_in_tree()<CR>',
			"show current buffer in the tree view",
		},
		["<leader>tt"] = {
			'<cmd>lua require"metals.tvp".toggle_tree_view()<CR>',
			"toggle the tree view",
		},
	}, { buffer = bufnr })
	wk.register({
		["<c-p>"] = {
			"<cmd>lua vim.lsp.buf.signature_help()<CR>",
			"show signature of current method",
		},
	}, { mode = "i", buffer = bufnr })
	wk.register({
		["<space>qf"] = {
			'<cmd>lua require("lspsaga.codeaction").code_action()<CR>',
			"show all possible actions for selected code",
		},
		["K"] = {
			"<Esc><cmd>lua require('metals').type_of_range()<CR>",
			"show type of selected code",
		},
	}, { mode = "v", buffer = bufnr })
end

return function(client, bufnr)
	highlight_setup(client)
	keys_mapping(client, bufnr)
	-- require('lsp_signature').on_attach({ bind = true }, bufnr)
end
