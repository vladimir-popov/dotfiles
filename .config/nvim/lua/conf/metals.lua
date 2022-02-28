------------------------------------------------------------
-- Metals
------------------------------------------------------------
local on_attach = require('conf/setup_lsp').on_attach

metals_config = require('metals').bare_config()
metals_config.init_options.statusBarProvider = 'on'
metals_config.settings = {
    showImplicitArguments = true,
    showInferredType = true,
}

metals_config.handlers['textDocument/publishDiagnostics'] = vim.lsp.with(
    vim.lsp.diagnostic.on_publish_diagnostics,
    {
        virtual_text = {
            prefix = '',
        },
    }
)

metals_config.handlers['metals/executeClientCommand'] = function(a0, result)
    if result.command == 'metals-doctor-run' or result.command == 'metals-doctor-reload' then
        local _, response_json = next(result.arguments)
        local response = vim.fn.json_decode(response_json)
        vim.b['is_metals_ok'] = type(response) == 'table' and response.targets
    end
    require('metals/handlers')['metals/executeClientCommand'](a0, result)
end

metals_config.tvp = {
    panel_alignment = 'right',
}

metals_config.on_attach = function(client, bufnr)
    -- turn on highlight and key mapping
    on_attach(client, bufnr)

    -- orginize import in scala
    require('utils').nmap('<leader>o', '<cmd>MetalsOrganizeImports<CR>')

    -- turn on dap support
    require('dap').configurations.scala = {
        {
            type = 'scala',
            request = 'launch',
            name = 'Run',
            metals = {
                runType = 'run',
            },
        },
        {
            type = 'scala',
            request = 'launch',
            name = 'Test File',
            metals = {
                runType = 'testFile',
            },
        },
    }
    require('metals').setup_dap()

    -- turn on plugin for better signature help
    require('lsp_signature').on_attach()
end

-- Run metals on open scala file
vim.cmd([[augroup scalametals]])
vim.cmd([[autocmd!]])
vim.cmd([[autocmd FileType scala,sbt lua require("metals").initialize_or_attach(metals_config)]])
vim.cmd([[augroup end]])

local M = {}

M.toggle_doctor = function()
    doctor = require('metals/doctor')
    if doctor.is_open() then
        doctor.close()
    else
        require('metals').run_doctor()
    end
end

return M
