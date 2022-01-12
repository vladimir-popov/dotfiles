------------------------------------------------------------
-- Metals
------------------------------------------------------------
local on_attach = require'conf/setup_lsp'.on_attach

metals_config = require'metals'.bare_config()
metals_config.init_options.statusBarProvider = "on"
metals_config.settings = {
   showImplicitArguments = true,
   showInferredType = true,
}

metals_config.handlers["textDocument/publishDiagnostics"] = vim.lsp.with(
  vim.lsp.diagnostic.on_publish_diagnostics, {
    virtual_text = {
      prefix = "",
    }
  }
)

metals_config.tvp = {
  panel_alignment = "right"
}

metals_config.on_attach = function(client, bufnr)
  -- turn on highlight and key mapping
  on_attach(client, bufnr)
  -- turn on dap support
  require'dap'.configurations.scala = {
    {
      type = "scala",
      request = "launch",
      name = "Run",
      metals = {
        runType = "run",
      },
    },
    {
      type = "scala",
      request = "launch",
      name = "Test File",
      metals = {
        runType = "testFile",
      },
    },
  }
  require'metals'.setup_dap()
end

-- orginize import in scala
require'utils'.nmap('<leader>o', '<cmd>MetalsOrganizeImports<CR>')

-- Run metals on open scala file
vim.cmd([[augroup scalametals]])
vim.cmd([[autocmd!]])
vim.cmd([[autocmd FileType scala,sbt lua require("metals").initialize_or_attach(metals_config)]])
vim.cmd([[augroup end]])
