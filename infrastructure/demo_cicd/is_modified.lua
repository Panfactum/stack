local function is_modified(body, regex_patterns)

    -- Function to check if a filename matches any regex pattern
    local function matches_any_pattern(filename)
        for _, pattern in ipairs(regex_patterns) do
            if string.match(filename, pattern) then
                return true
            end
        end
        return false
    end

    -- Iterate through each commit
    for _, commit in ipairs(body.commits) do
        -- Check modified files
        for _, modified_file in ipairs(commit.modified) do
            if matches_any_pattern(modified_file) then
                return true
            end
        end
        -- Check added files (in case the file was newly added)
        for _, added_file in ipairs(commit.added) do
            if matches_any_pattern(added_file) then
                return true
            end
        end
        -- Check removed files (in case the file was deleted)
        for _, removed_file in ipairs(commit.removed) do
            if matches_any_pattern(removed_file) then
                return true
            end
        end
    end

    return false
end