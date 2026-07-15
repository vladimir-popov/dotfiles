return {
    {
        name = "lsp-control",
        dir = vim.fn.stdpath("config") .. "/lua/plugins",
        dependencies = { "folke/which-key.nvim" },
        event = "VeryLazy",
        config = function()
            local wk = require("which-key")
            local function available_lsp_config_names()
                local names = {}

                for _, path in ipairs(vim.api.nvim_get_runtime_file("lsp/*.lua", true)) do
                    local name = vim.fn.fnamemodify(path, ":t:r")
                    table.insert(names, name)
                end

                return names
            end

            local function servers_for_filetype(filetype)
                local servers = {}

                for _, name in ipairs(available_lsp_config_names()) do
                    local config = vim.lsp.config[name]

                    if config and vim.tbl_contains(config.filetypes or {}, filetype) then
                        table.insert(servers, name)
                    end
                end

                return servers
            end

            local function current_lsp_servers()
                local clients = vim.lsp.get_clients({ bufnr = 0 })

                if #clients > 0 then
                    return vim.tbl_map(function(client)
                        return client.name
                    end, clients)
                end

                return servers_for_filetype(vim.bo.filetype)
            end

            local function notify_if_empty(servers)
                if #servers == 0 then
                    vim.notify("No LSP servers found for filetype: " .. vim.bo.filetype, vim.log.levels.WARN)
                    return true
                end

                return false
            end

            wk.add({
                { "<leader>l", group = "LSP" },

                {
                    "<leader>ls",
                    function()
                        local servers = current_lsp_servers()
                        if notify_if_empty(servers) then
                            return
                        end

                        vim.notify("Run LSP: " .. vim.inspect(servers), vim.log.levels.INFO)
                        vim.lsp.enable(servers, true)
                    end,
                    desc = "Start LSP",
                },

                {
                    "<leader>lx",
                    function()
                        local servers = current_lsp_servers()
                        if notify_if_empty(servers) then
                            return
                        end

                        vim.notify("Stop LSP: " .. vim.inspect(servers), vim.log.levels.INFO)
                        vim.lsp.enable(servers, false)
                    end,
                    desc = "Stop LSP",
                },

                {
                    "<leader>lr",
                    function()
                        local servers = current_lsp_servers()
                        if notify_if_empty(servers) then
                            return
                        end

                        vim.notify("Restart LSP: " .. vim.inspect(servers), vim.log.levels.INFO)
                        vim.lsp.enable(servers, false)
                        vim.defer_fn(function()
                            vim.lsp.enable(servers, true)
                        end, 100)
                    end,
                    desc = "Restart LSP",
                },
            })
        end,
    },
}
