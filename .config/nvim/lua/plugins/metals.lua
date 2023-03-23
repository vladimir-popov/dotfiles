return {
    'scalameta/nvim-metals',
    dependencies = {
        { 'tami5/lspsaga.nvim' },
        { 'ray-x/lsp_signature.nvim' },
    },
    ft = { 'scala', 'sbt' },
    keys = {
        {
            '<leader>]',
            function()
                local doctor = require('metals/doctor')
                if doctor.is_open() then
                    doctor.close()
                else
                    require('metals').run_doctor()
                end
            end,
            desc = 'run Metals doctor',
        },
    },
    config = function()
        local metals_config = require('metals').bare_config()
        metals_config.init_options.statusBarProvider = 'on'
        metals_config.settings = {
            showImplicitArguments = true,
            showInferredType = false,
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
            if
                result.command == 'metals-doctor-run'
                or result.command == 'metals-doctor-reload'
            then
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
            require('lsp_on_attach')(client, bufnr)

            local wk = require('which-key')
            wk.register({
                ['K'] = {
                    "<Esc><cmd>lua require('metals').type_of_range()<CR>",
                    'show type of selected code',
                },
            }, { mode = 'v', buffer = bufnr })

            wk.register({
                ['<leader>o'] = { '<cmd>MetalsOrganizeImports<CR>', 'organize import in scala' },
            }, { buffer = bufnr })
        end

        -- Run metals on open scala file
        local aug_id = vim.api.nvim_create_augroup('scalametals', { clear = true })
        vim.api.nvim_create_autocmd('FileType', {
            group = aug_id,
            pattern = { 'scala', 'sbt' },
            callback = function()
                require('metals').initialize_or_attach(metals_config)
            end,
        })
    end,
}
