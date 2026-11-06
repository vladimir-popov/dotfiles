local M = {}

local EXTENSION_PROBE_TIMEOUT_MS = 8000
local EXTENSION_PROBE_RETRY_MS = 250

local defaults = {
    position = "tab",
    command = "pi",
    provider = nil,
    model = nil,
    cwd = nil,
}

local options = vim.deepcopy(defaults)
local session
local references_qf_id

local function notify_error(message)
    vim.notify("pi-nvim: " .. message, vim.log.levels.ERROR)
end

local function is_valid_buffer(buf)
    return buf ~= nil and vim.api.nvim_buf_is_valid(buf)
end

local function windows_showing(buf)
    local result = {}
    for _, tab in ipairs(vim.api.nvim_list_tabpages()) do
        for _, win in ipairs(vim.api.nvim_tabpage_list_wins(tab)) do
            if vim.api.nvim_win_get_buf(win) == buf then
                result[#result + 1] = win
            end
        end
    end
    return result
end

local function cleanup_socket(current)
    if current.references_server then
        for client in pairs(current.references_clients or {}) do
            if not client:is_closing() then
                client:close()
            end
        end
        if not current.references_server:is_closing() then
            current.references_server:close()
        end
        current.references_server = nil
    end
    if not current.socket_dir then
        return
    end
    pcall(vim.uv.fs_unlink, current.socket_path)
    pcall(vim.uv.fs_unlink, current.references_socket_path)
    pcall(vim.uv.fs_rmdir, current.socket_dir)
    current.socket_dir = nil
end

local function create_socket_endpoint()
    local entropy = table.concat({ tostring(vim.uv.hrtime()), tostring(vim.uv.getpid()), vim.fn.tempname() }, ":")
    for attempt = 1, 8 do
        local token = vim.fn.sha256(entropy .. ":" .. attempt)
        local directory = "/tmp/pin-" .. token:sub(1, 20)
        local ok, err = vim.uv.fs_mkdir(directory, 448)
        if ok then
            return {
                socket_dir = directory,
                socket_path = directory .. "/s.sock",
                references_socket_path = directory .. "/r.sock",
                token = token,
            }
        end
        if not tostring(err):match("EEXIST") then
            return nil, "could not create a private Pi socket directory: " .. tostring(err)
        end
    end
    return nil, "could not allocate a unique Pi socket directory"
end

local function finish_session(current, delete_buffer)
    if session ~= current then
        return
    end

    -- Clear first: stopping the job or deleting the buffer can trigger autocmds.
    session = nil
    if current.cancel_selection then
        current.cancel_selection()
    end
    if current.cancel_probe then
        current.cancel_probe()
    end
    if current.job then
        local status = vim.fn.jobwait({ current.job }, 0)[1]
        if status == -1 then
            vim.fn.jobstop(current.job)
        end
    end

    cleanup_socket(current)

    if delete_buffer and is_valid_buffer(current.buf) then
        pcall(vim.api.nvim_buf_delete, current.buf, { force = true })
    end
end

local function cleanup_if_hidden(current)
    vim.schedule(function()
        if session == current and #windows_showing(current.buf) == 0 then
            finish_session(current, true)
        end
    end)
end

local function focus_session(current)
    local wins = windows_showing(current.buf)
    if #wins == 0 then
        finish_session(current, true)
        return false
    end

    for _, tab in ipairs(vim.api.nvim_list_tabpages()) do
        for _, win in ipairs(vim.api.nvim_tabpage_list_wins(tab)) do
            if win == wins[1] then
                vim.api.nvim_set_current_tabpage(tab)
                vim.api.nvim_set_current_win(win)
                vim.cmd("startinsert")
                return true
            end
        end
    end
    return false
end

local function validate_options(opts)
    if
        type(opts.position) ~= "string"
        or (opts.position ~= "tab" and opts.position ~= "horizontal" and opts.position ~= "vertical")
    then
        return "position must be 'tab', 'horizontal', or 'vertical'"
    end
    if type(opts.command) ~= "string" and type(opts.command) ~= "table" then
        return "command must be a non-empty string or a list of arguments"
    end
    if type(opts.command) == "string" and opts.command == "" then
        return "command must not be empty"
    end
    if type(opts.command) == "table" then
        if #opts.command == 0 then
            return "command argument list must not be empty"
        end
        for _, arg in ipairs(opts.command) do
            if type(arg) ~= "string" then
                return "command argument list must contain only strings"
            end
        end
    end
    for _, name in ipairs({ "provider", "model" }) do
        if opts[name] ~= nil and (type(opts[name]) ~= "string" or opts[name] == "") then
            return name .. " must be a non-empty string or nil"
        end
    end
    if opts.provider and not opts.model then
        return "provider requires model"
    end
    if opts.cwd ~= nil and type(opts.cwd) ~= "string" then
        return "cwd must be a directory path or nil"
    end
    return nil
end

local function capture_selection()
    local buf = vim.api.nvim_get_current_buf()
    local active_mode = vim.fn.mode(1)
    local visual_type
    local start_pos
    local end_pos

    if active_mode == "v" or active_mode == "V" or active_mode == "\22" then
        visual_type = active_mode
        start_pos = vim.fn.getpos("v")
        end_pos = vim.fn.getpos(".")
    else
        visual_type = vim.fn.visualmode()
        start_pos = vim.fn.getpos("'<")
        end_pos = vim.fn.getpos("'>")
    end

    if visual_type ~= "v" and visual_type ~= "V" and visual_type ~= "\22" then
        return nil, "make a characterwise, linewise, or blockwise visual selection first"
    end
    if start_pos[2] < 1 or end_pos[2] < 1 then
        return nil, "no visual selection is available"
    end
    if start_pos[1] == 0 then
        start_pos[1] = buf
    end
    if end_pos[1] == 0 then
        end_pos[1] = buf
    end
    if start_pos[1] ~= buf or end_pos[1] ~= buf then
        return nil, "the visual selection is not in the current buffer"
    end

    local name = vim.api.nvim_buf_get_name(buf)
    local source
    if name ~= "" and vim.bo[buf].buftype == "" then
        source = {
            kind = "file",
            name = vim.fn.fnamemodify(name, ":p"),
        }
    else
        source = {
            kind = "buffer",
            name = name ~= "" and name or string.format("[unnamed buffer #%d]", buf),
        }
    end

    local ok, lines = pcall(vim.fn.getregion, start_pos, end_pos, {
        type = visual_type,
        exclusive = vim.o.selection == "exclusive",
    })
    if not ok or type(lines) ~= "table" or #lines == 0 then
        return nil, "could not read the visual selection"
    end

    local start_line = math.min(start_pos[2], end_pos[2])
    local end_line = math.max(start_pos[2], end_pos[2])
    local text = table.concat(lines, "\n")
    -- A linewise yank is line-oriented and includes the terminating newline.
    if visual_type == "V" then
        text = text .. "\n"
    end

    return {
        text = text,
        source = source,
        startLine = start_line,
        endLine = end_line,
    }
end

local function send_input_request(current, request)
    local uv = vim.uv
    local pipe
    local timeout_timer = uv.new_timer()
    local retry_timer = uv.new_timer()
    local chunks = {}
    local finished = false
    local last_connect_error = "unknown socket error"
    local cancel
    local payload = vim.json.encode({
        kind = "input",
        version = 2,
        prompt = request.prompt,
        selection = request.selection,
        token = current.token,
    }) .. "\n"

    local function finish(err, response)
        if finished then
            return
        end
        finished = true
        timeout_timer:stop()
        timeout_timer:close()
        retry_timer:stop()
        retry_timer:close()
        if pipe then
            pcall(pipe.read_stop, pipe)
            if not pipe:is_closing() then
                pipe:close()
            end
        end
        if current.cancel_selection == cancel then
            current.cancel_selection = nil
        end

        vim.schedule(function()
            if err then
                notify_error("input delivery failed: " .. err)
                return
            end
            if type(response) ~= "table" or response.ok ~= true then
                local reason = type(response) == "table" and response.error or "invalid response"
                notify_error("Pi could not insert the input: " .. tostring(reason))
                return
            end
            if session ~= current then
                notify_error("the Pi session ended before the input could be focused")
                return
            end
            if not focus_session(current) then
                notify_error("input was delivered, but the Pi terminal is no longer available")
            end
        end)
    end

    local function parse_response()
        local data = table.concat(chunks)
        local newline = data:find("\n", 1, true)
        if not newline then
            return false
        end
        local ok, response = pcall(vim.json.decode, data:sub(1, newline - 1))
        if not ok then
            finish("Pi returned an invalid response")
        else
            finish(nil, response)
        end
        return true
    end

    local function attempt_connect()
        if finished then
            return
        end
        pipe = uv.new_pipe(false)
        local active_pipe = pipe
        active_pipe:connect(current.socket_path, function(connect_err)
            if finished then
                return
            end
            if connect_err then
                last_connect_error = tostring(connect_err)
                active_pipe:close()
                retry_timer:start(100, 0, attempt_connect)
                return
            end

            active_pipe:read_start(function(read_err, chunk)
                if finished then
                    return
                end
                if read_err then
                    finish("could not read the Pi extension response: " .. tostring(read_err))
                elseif chunk then
                    chunks[#chunks + 1] = chunk
                    if #table.concat(chunks) > 4096 then
                        finish("Pi extension response was too large")
                    else
                        parse_response()
                    end
                else
                    finish("Pi extension closed the connection without a response")
                end
            end)
            active_pipe:write(payload, function(write_err)
                if finished then
                    return
                end
                if write_err then
                    finish("could not write to the Pi extension: " .. tostring(write_err))
                end
            end)
        end)
    end

    cancel = function()
        finish("the managed Pi session ended before the input was delivered")
    end
    current.cancel_selection = cancel
    timeout_timer:start(12000, 0, function()
        finish("timed out waiting for the Pi extension (last socket error: " .. last_connect_error .. ")")
    end)
    attempt_connect()
end

local function probe_extension(current)
    local uv = vim.uv
    local timeout_timer = uv.new_timer()
    local retry_timer = uv.new_timer()
    local pipe
    local finished = false
    local last_connect_error = "Pi extension socket is not available"
    local cancel

    local function close_handles()
        timeout_timer:stop()
        timeout_timer:close()
        retry_timer:stop()
        retry_timer:close()
        if pipe then
            pcall(pipe.read_stop, pipe)
            if not pipe:is_closing() then
                pipe:close()
            end
            pipe = nil
        end
    end

    local function finish(err, response)
        if finished then
            return
        end
        finished = true
        close_handles()
        if current.cancel_probe == cancel then
            current.cancel_probe = nil
        end
        if session ~= current then
            return
        end
        if not err and (type(response) ~= "table" or response.ok ~= true or response.ready ~= true) then
            local reason = type(response) == "table" and response.error or "invalid readiness response"
            err = "Pi extension did not become ready: " .. tostring(reason)
        end
        if err then
            current.extension_ready = false
            current.extension_error = err
            if not current.cancel_selection then
                vim.schedule(function()
                    if session == current and current.job then
                        vim.notify(
                            "pi-nvim: Pi extension is unavailable. Ensure the pi-nvim extension is enabled for this session; check Pi startup output for load errors. "
                                .. tostring(err),
                            vim.log.levels.WARN
                        )
                    end
                end)
            end
            return
        end
        current.extension_ready = true
        current.extension_error = nil
    end

    local function attempt_connect()
        if finished or session ~= current or not current.job then
            cancel()
            return
        end
        pipe = uv.new_pipe(false)
        local active_pipe = pipe
        active_pipe:connect(current.socket_path, function(connect_err)
            if finished then
                return
            end
            if connect_err then
                last_connect_error = tostring(connect_err)
                active_pipe:close()
                if pipe == active_pipe then
                    pipe = nil
                end
                retry_timer:start(EXTENSION_PROBE_RETRY_MS, 0, attempt_connect)
                return
            end

            local payload = vim.json.encode({
                kind = "ping",
                version = 2,
                token = current.token,
            }) .. "\n"
            local chunks = {}
            active_pipe:read_start(function(read_err, chunk)
                if finished then
                    return
                end
                if read_err then
                    finish("could not read the Pi extension readiness response: " .. tostring(read_err))
                elseif chunk then
                    chunks[#chunks + 1] = chunk
                    local data = table.concat(chunks)
                    if #data > 4096 then
                        finish("Pi extension readiness response was too large")
                        return
                    end
                    local newline = data:find("\n", 1, true)
                    if newline then
                        local ok, response = pcall(vim.json.decode, data:sub(1, newline - 1))
                        if ok then
                            finish(nil, response)
                        else
                            finish("Pi extension returned an invalid readiness response")
                        end
                    end
                else
                    finish("Pi extension closed the readiness connection without a response")
                end
            end)
            active_pipe:write(payload, function(write_err)
                if write_err and not finished then
                    finish("could not send the Pi extension readiness check: " .. tostring(write_err))
                end
            end)
        end)
    end

    cancel = function()
        if finished then
            return
        end
        finished = true
        close_handles()
        if current.cancel_probe == cancel then
            current.cancel_probe = nil
        end
    end
    current.cancel_probe = cancel
    timeout_timer:start(EXTENSION_PROBE_TIMEOUT_MS, 0, function()
        finish("timed out waiting for the Pi extension (last socket error: " .. last_connect_error .. ")")
    end)
    attempt_connect()
end

local open_terminal

local function capture_command_selection(command)
    local ok = pcall(vim.cmd, "normal! gv")
    local mode = vim.fn.mode(1)
    if not ok or (mode ~= "v" and mode ~= "V" and mode ~= "\22") then
        return nil, "could not restore the Visual selection"
    end

    local selection, err = capture_selection()
    vim.cmd("normal! \27")
    if not selection then
        return nil, err
    end
    if
        math.min(selection.startLine, selection.endLine) ~= command.line1
        or math.max(selection.startLine, selection.endLine) ~= command.line2
    then
        return nil, "the command range does not match the last Visual selection"
    end
    return selection
end

local function run_pi_command(command)
    local prompt = command.args or ""
    local has_selection = command.range > 0
    local current_win = vim.api.nvim_get_current_win()

    if prompt == "" and not has_selection and session and vim.api.nvim_win_get_buf(current_win) == session.buf then
        local return_win = session.return_win
        if
            return_win
            and vim.api.nvim_win_is_valid(return_win)
            and vim.api.nvim_win_get_buf(return_win) ~= session.buf
        then
            vim.api.nvim_set_current_win(return_win)
        else
            vim.notify("pi-nvim: the previous window is no longer available", vim.log.levels.INFO)
        end
        return
    end

    local selection
    if has_selection then
        local selection_request, selection_err = capture_command_selection(command)
        if not selection_request then
            notify_error(selection_err)
            return
        end
        selection = {
            text = selection_request.text,
            source = selection_request.source,
            startLine = selection_request.startLine,
            endLine = selection_request.endLine,
        }
    end

    if prompt == "" and not selection then
        open_terminal()
        return
    end

    local current = session
    if not current or #windows_showing(current.buf) == 0 then
        current = open_terminal()
        if not current then
            return
        end
    elseif not current.job then
        notify_error("the managed Pi process has exited; close its terminal window before sending input")
        return
    end
    if current.cancel_selection then
        notify_error("input is already being delivered to Pi")
        return
    end
    send_input_request(current, { prompt = prompt, selection = selection })
end

local function command_with_model_options()
    local command = vim.deepcopy(options.command)
    if type(command) == "table" then
        if options.provider then
            vim.list_extend(command, { "--provider", options.provider })
        end
        if options.model then
            vim.list_extend(command, { "--model", options.model })
        end
        return command
    end

    if options.provider then
        command = command .. " --provider " .. vim.fn.shellescape(options.provider)
    end
    if options.model then
        command = command .. " --model " .. vim.fn.shellescape(options.model)
    end
    return command
end

local function update_references(items)
    local what = {
        title = "Pi References",
        items = items,
    }
    if references_qf_id then
        local info = vim.fn.getqflist({ id = references_qf_id })
        if info.id == references_qf_id then
            what.id = references_qf_id
            local ok, result = pcall(vim.fn.setqflist, {}, "r", what)
            if ok and result == 0 then
                return
            end
        end
        references_qf_id = nil
    end

    local previous = vim.fn.getqflist({ id = 0, nr = 0 })
    local ok, result = pcall(vim.fn.setqflist, {}, " ", what)
    if not ok or result ~= 0 then
        error("could not update the Pi References quickfix list")
    end
    local created = vim.fn.getqflist({ id = 0, nr = 0 })
    references_qf_id = created.id
    if previous.id > 0 and created.nr > previous.nr then
        pcall(vim.cmd, "silent colder " .. (created.nr - previous.nr))
    end
end

local function start_references_server(current)
    local uv = vim.uv
    local server = uv.new_pipe(false)
    current.references_server = server
    current.references_clients = {}

    local bound, bind_err = server:bind(current.references_socket_path)
    if not bound then
        cleanup_socket(current)
        return nil, "could not bind the Pi references socket: " .. tostring(bind_err)
    end

    local function handle_client(client)
        current.references_clients[client] = true
        local data = ""
        local replied = false
        local request_received = false
        local function reply(ok, err)
            if replied then
                return
            end
            replied = true
            pcall(client.read_stop, client)
            local response = vim.json.encode({ ok = ok, error = err }) .. "\n"
            if client:is_closing() then
                current.references_clients[client] = nil
                return
            end
            client:write(response, function()
                current.references_clients[client] = nil
                if not client:is_closing() then
                    client:close()
                end
            end)
        end

        client:read_start(function(read_err, chunk)
            if replied or request_received then
                return
            end
            if read_err then
                reply(false, "could not read the Pi references request")
                return
            end
            if not chunk then
                reply(false, "Pi closed the references connection without a request")
                return
            end
            data = data .. chunk
            if #data > 4 * 1024 * 1024 then
                reply(false, "Pi references request is too large")
                return
            end
            local newline = data:find("\n", 1, true)
            if not newline then
                return
            end
            request_received = true
            pcall(client.read_stop, client)
            if newline ~= #data then
                reply(false, "expected one newline-delimited Pi references request")
                return
            end

            local decoded, request = pcall(vim.json.decode, data:sub(1, newline - 1))
            if
                not decoded
                or type(request) ~= "table"
                or request.kind ~= "references"
                or request.version ~= 1
                or request.token ~= current.token
                or type(request.items) ~= "table"
                or #request.items > 5000
            then
                reply(false, "Pi references request is invalid or unauthenticated")
                return
            end

            local items = {}
            for _, item in ipairs(request.items) do
                if
                    type(item) ~= "table"
                    or type(item.path) ~= "string"
                    or item.path == ""
                    or item.path:sub(1, 1) ~= "/"
                    or type(item.line) ~= "number"
                    or item.line < 1
                    or item.line % 1 ~= 0
                then
                    reply(false, "Pi references request contains an invalid entry")
                    return
                end
                items[#items + 1] = {
                    filename = item.path,
                    lnum = item.line,
                    col = 1,
                    text = item.path,
                }
            end

            vim.schedule(function()
                if session ~= current or not current.job then
                    reply(false, "the managed Pi session has ended")
                    return
                end
                local ok, update_err = pcall(update_references, items)
                if not ok then
                    reply(false, tostring(update_err))
                    return
                end
                reply(true)
            end)
        end)
    end

    local listening, listen_err = server:listen(16, function(err)
        if err then
            notify_error("Pi references socket failed: " .. tostring(err))
            return
        end
        local client = uv.new_pipe(false)
        local accepted, result, accept_err = pcall(server.accept, server, client)
        if not accepted or result ~= 0 then
            client:close()
            notify_error("could not accept a Pi references update: " .. tostring(accept_err or result))
            return
        end
        handle_client(client)
    end)
    if not listening then
        cleanup_socket(current)
        return nil, "could not listen on the Pi references socket: " .. tostring(listen_err)
    end
    return true
end

local function open_references()
    if not references_qf_id then
        vim.notify("pi-nvim: there are no Pi references yet", vim.log.levels.INFO)
        return
    end

    local info = vim.fn.getqflist({ id = references_qf_id, nr = 0 })
    if info.id ~= references_qf_id or info.nr < 1 then
        references_qf_id = nil
        notify_error("the Pi References quickfix list is no longer available")
        return
    end

    local current_info = vim.fn.getqflist({ nr = 0 })
    local distance = info.nr - current_info.nr
    if distance < 0 then
        vim.cmd("silent colder " .. -distance)
    elseif distance > 0 then
        vim.cmd("silent cnewer " .. distance)
    end
    vim.cmd("copen")
end

open_terminal = function()
    local return_win = vim.api.nvim_get_current_win()
    if session then
        if vim.api.nvim_win_get_buf(return_win) ~= session.buf then
            session.return_win = return_win
        end
        if focus_session(session) then
            return session
        end
    end

    local cwd = options.cwd or vim.fn.getcwd()
    if vim.fn.isdirectory(cwd) ~= 1 then
        notify_error("working directory does not exist: " .. cwd)
        return
    end

    local endpoint, endpoint_err = create_socket_endpoint()
    if not endpoint then
        notify_error(endpoint_err)
        return
    end

    local buf = vim.api.nvim_create_buf(false, true)
    local open_ok, open_err = pcall(function()
        if options.position == "tab" then
            vim.cmd("tabnew")
        elseif options.position == "horizontal" then
            vim.cmd("belowright split")
        else
            vim.cmd("belowright vsplit")
        end
        vim.api.nvim_win_set_buf(0, buf)
    end)
    if not open_ok then
        cleanup_socket(endpoint)
        if is_valid_buffer(buf) then
            pcall(vim.api.nvim_buf_delete, buf, { force = true })
        end
        notify_error("could not open terminal window: " .. tostring(open_err))
        return
    end

    vim.bo[buf].bufhidden = "hide"
    vim.bo[buf].swapfile = false

    local current = {
        buf = buf,
        return_win = return_win,
        job = nil,
        socket_dir = endpoint.socket_dir,
        socket_path = endpoint.socket_path,
        references_socket_path = endpoint.references_socket_path,
        token = endpoint.token,
    }
    session = current
    vim.api.nvim_create_autocmd("BufWinLeave", {
        buffer = buf,
        callback = function()
            cleanup_if_hidden(current)
        end,
    })
    vim.api.nvim_create_autocmd("BufWipeout", {
        buffer = buf,
        once = true,
        callback = function()
            finish_session(current, false)
        end,
    })

    local references_ok, references_err = start_references_server(current)
    if not references_ok then
        finish_session(current, true)
        notify_error(references_err)
        return nil
    end

    local ok, job = pcall(vim.fn.termopen, command_with_model_options(), {
        cwd = cwd,
        env = {
            PI_NVIM_SOCKET_PATH = current.socket_path,
            PI_NVIM_SOCKET_TOKEN = current.token,
            PI_NVIM_REFERENCES_SOCKET_PATH = current.references_socket_path,
            PI_NVIM_CWD = vim.fn.fnamemodify(cwd, ":p"),
        },
        on_exit = function(_, _, _)
            if session == current then
                current.job = nil
                if current.cancel_selection then
                    current.cancel_selection()
                end
                if current.cancel_probe then
                    current.cancel_probe()
                end
            end
            cleanup_socket(current)
        end,
    })
    if not ok or type(job) ~= "number" or job <= 0 then
        finish_session(current, true)
        notify_error("could not start command: " .. tostring(job))
        return nil
    end
    current.job = job
    probe_extension(current)
    vim.cmd("startinsert")
    return current
end

function M.setup(opts)
    opts = opts or {}
    if type(opts) ~= "table" then
        error("pi-nvim setup expects an options table", 2)
    end

    options = vim.tbl_deep_extend("force", vim.deepcopy(defaults), opts)
    local problem = validate_options(options)
    if problem then
        error("pi-nvim: " .. problem, 2)
    end

    vim.api.nvim_create_user_command("Pi", run_pi_command, {
        nargs = "*",
        range = true,
        desc = "Open, focus, or send input to the managed Pi terminal",
    })
    vim.api.nvim_create_user_command("PiReferences", open_references, {
        desc = "Open the latest Pi file references",
    })
end

return M
