local M = {
    'scalameta/nvim-metals',
    dependencies = {
        { 'nvimdev/lspsaga.nvim' },
        { 'ray-x/lsp_signature.nvim' },
        { 'mfussenegger/nvim-dap' },
        { 'hrsh7th/nvim-cmp' },
    },
    -- ft = { 'scala', 'sbt', 'java' },
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
        {
            '<space>cc',
            function()
                require('plugins.metals').copyFullClassName()
            end,
            desc = 'copy full class name',
        },
    },
    config = function()
        local metals_config = require('metals').bare_config()
        metals_config.init_options.statusBarProvider = 'on'
        metals_config.settings = {
            autoImportBuild = false,
            showImplicitArguments = true,
            showInferredType = false,
            ['javaFormat.eclipseConfigPath'] = vim.fn.stdpath('config')
                .. '/formatters/eclipse-formatter.xml',
            ['javaFormat.eclipseProfile'] = 'GoogleStyle',
        }

        metals_config.handlers['textDocument/publishDiagnostics'] =
            vim.lsp.with(vim.lsp.diagnostic.on_publish_diagnostics, {
                virtual_text = {
                    prefix = '',
                },
            })

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

            require('metals').setup_dap()

            local wk = require('which-key')
            wk.add({
                {
                    'K',
                    "<Esc><cmd>lua require('metals').type_of_range()<CR>",
                    desc = 'show type of selected code',
                    mode = 'v',
                    buffer = bufnr
                },
                {
                    '<leader>o',
                    '<cmd>MetalsOrganizeImports<CR>',
                    desc = 'organize import in scala',
                    buffer = bufnr
                },
            })
        end

        metals_config.find_root_dir_max_project_nesting = 2
        metals_config.find_root_dir = function(patterns, bufname, maxParentSearch)
            if string.find(bufname, 'dash/scripts') then
                return vim.fn.expand("%:p:h")
            else
                local root_dir = require("metals.rootdir")
                return root_dir.find_root_dir(patterns, bufname, maxParentSearch)
            end
        end

        metals_config.capabilities = require('cmp_nvim_lsp').default_capabilities()

        -- Run metals on open scala file
        local aug_id = vim.api.nvim_create_augroup('scalametals', { clear = true })
        vim.api.nvim_create_autocmd('FileType', {
            group = aug_id,
            pattern = { 'scala', 'sbt', 'java' },
            callback = function()
                require('metals').initialize_or_attach(metals_config)
            end,
        })
    end,
}

M.getFullClassName = function()
    local symbol = vim.fn.expand('<cword>')
    if not string.match(symbol, '%w+') then
        vim.notify('Unappropriate class name ' .. symbol, vim.log.levels.ERROR)
        return
    end
    local line = vim.api.nvim_get_current_line()
    if
        not (
        string.find(line, 'class%s+' .. symbol)
        or string.find(line, 'object%s+' .. symbol)
        or string.find(line, 'trait%s+' .. symbol)
        )
    then
        vim.notify(
            'The full name of the ['
            .. symbol
            .. "] can't be copied. Put cursor on the object|class|trait name in declaration and try again.",
            vim.log.levels.ERROR
        )
        return
    end

    local pkg = ''
    local pos = vim.fn.searchpos('package\\s\\+', 'cne')
    if pos[1] > 0 then
        pkg = vim.fn.trim(string.sub(vim.fn.getline(pos[1]), pos[2]))
    end
    return pkg .. '.' .. symbol
end

M.copyFullClassName = function()
    local cn = M.getFullClassName()
    if not cn then
        return
    end
    vim.fn.setreg('+', cn)
    vim.notify(cn .. ' was copied to the clipboard', vim.log.levels.DEBUG)
end

return M
