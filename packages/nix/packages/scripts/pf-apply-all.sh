#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to get module groups using terragrunt output-module-groups
get_module_groups() {
    terragrunt output-module-groups --terragrunt-non-interactive
}

# Function to display dependency groups in a formatted way
display_module_groups() {
    local groups_json=$1
    
    print_status "$BLUE" "Dependency Groups:"
    
    # Get all group names and handle them properly with line breaks
    mapfile -t group_names < <(echo "$groups_json" | jq -r 'keys[]')
    
    # Iterate through each group
    for group_name in "${group_names[@]}"; do
        print_status "$GREEN" "$group_name:"
        
        # Get modules in this group - using mapfile to handle paths with spaces
        mapfile -t modules < <(echo "$groups_json" | jq -r --arg group "$group_name" '.[$group][]')
        
        # Display modules 
        for module in "${modules[@]}"; do
            if [ -n "$module" ]; then
                print_status "$YELLOW" "  * $module"
            fi
        done
    done
}

# Function to apply a single module
apply_module() {
    local module_path=$1
    local log_file=$2
    
    print_status "$YELLOW" "Starting module: $module_path"
    (cd "$module_path" && terragrunt apply -auto-approve > "$log_file" 2>&1)
    local exit_code=$?
    echo "EXIT_CODE=$exit_code" >> "$log_file"
    return $exit_code
}

# Function to retry a failed module
retry_module() {
    local module_path=$1
    local retry_count=0
    local success=false

    while [ "$success" = false ]; do
        if [ $retry_count -gt 0 ]; then
            print_status "$YELLOW" "Retry #$retry_count for module: $module_path"
        else
            print_status "$YELLOW" "Retrying module: $module_path"
        fi
        
        if (cd "$module_path" && terragrunt apply -auto-approve); then
            print_status "$GREEN" "Successfully applied module: $module_path"
            success=true
        else
            retry_count=$((retry_count + 1))
            print_status "$RED" "Failed to apply module: $module_path"
            print_status "$YELLOW" "Would you like to retry, skip to the next module, or exit? (r/s/e)"
            
            # Read from /dev/tty to ensure we're getting user input
            read -r response < /dev/tty
            if [[ $response =~ ^[Ee]$ ]]; then
                print_status "$RED" "User cancelled deployment. Exiting..."
                exit 1
            elif [[ $response =~ ^[Ss]$ ]]; then
                print_status "$YELLOW" "Skipping module: $module_path"
                return 1
            fi
            # Any other response will retry
        fi
    done

    return 0
}

# Create a temporary directory for log files
setup_temp_dir() {
    local temp_dir=$(mktemp -d)
    echo "$temp_dir"
}

# Clean up temporary files
cleanup_temp_dir() {
    local temp_dir=$1
    rm -rf "$temp_dir"
}

# Main script
main() {
    print_status "$GREEN" "Getting Terragrunt module groups..."
    
    # Get module groups in JSON format
    local groups_json=$(get_module_groups)
    
    # Check if groups were found
    if [ -z "$groups_json" ] || [ "$groups_json" == "{}" ]; then
        print_status "$RED" "No module groups found!"
        exit 1
    fi
    
    # Display the module groups
    display_module_groups "$groups_json"
    
    # Process each group - using mapfile to avoid pipe issues and handle spaces in names
    mapfile -t group_names < <(echo "$groups_json" | jq -r 'keys[]')
    
    for group_name in "${group_names[@]}"; do
        print_status "$BLUE" "--------------------------------------------------------------------------------"
        print_status "$GREEN" "Preparing to process $group_name"
        
        # Get modules in this group - properly handle spaces in group names
        mapfile -t modules < <(echo "$groups_json" | jq -r --arg group "$group_name" '.[$group][]')
        
        # Display modules in this group
        print_status "$YELLOW" "Modules in $group_name:"
        for module in "${modules[@]}"; do
            if [ -n "$module" ]; then
                print_status "$YELLOW" "  * $module"
            fi
        done
        
        # Confirm before proceeding with this group
        print_status "$BLUE" "Would you like to proceed with $group_name? (y/n)"
        # Read from /dev/tty to ensure we're getting user input
        read -r response < /dev/tty
        if [[ ! $response =~ ^[Yy]$ ]]; then
            print_status "$RED" "Skipping $group_name"
            continue
        fi
        
        # Create temporary directory for logs
        local temp_dir=$(setup_temp_dir)
        declare -a pids=()
        declare -a module_paths=()
        declare -a log_files=()
        
        print_status "$GREEN" "Applying modules in $group_name in parallel..."
        
        # Start all modules in parallel
        local module_index=0
        for module in "${modules[@]}"; do
            if [ -n "$module" ]; then
                local log_file="$temp_dir/module_${module_index}_$(basename "$module").log"
                module_paths[$module_index]="$module"
                log_files[$module_index]="$log_file"
                
                apply_module "$module" "$log_file" &
                pids[$module_index]=$!
                
                module_index=$((module_index + 1))
            fi
        done
        
        # Wait for all processes to complete
        declare -a failed_modules=()
        declare -a failed_log_files=()
        
        for i in "${!pids[@]}"; do
            if [ -n "${pids[$i]}" ]; then
                wait "${pids[$i]}" || true
                
                # Check exit code from log file
                if grep -q "EXIT_CODE=0" "${log_files[$i]}"; then
                    print_status "$GREEN" "Module ${module_paths[$i]} completed successfully"
                else
                    print_status "$RED" "Module ${module_paths[$i]} failed"
                    failed_modules+=("${module_paths[$i]}")
                    failed_log_files+=("${log_files[$i]}")
                fi
            fi
        done
        
        # Display logs for failed modules
        if [ ${#failed_modules[@]} -gt 0 ]; then
            print_status "$RED" "The following modules failed:"
            
            for i in "${!failed_modules[@]}"; do
                local module="${failed_modules[$i]}"
                local log_file="${failed_log_files[$i]}"
                
                print_status "$RED" "  * $module"
                print_status "$YELLOW" "Error log for $module:"
                grep -v "EXIT_CODE=" "$log_file" | tail -n 20 | sed 's/^/    /'
                echo
            done
            
            # Process failed modules one by one
            print_status "$YELLOW" "Processing failed modules sequentially"
            
            for module in "${failed_modules[@]}"; do
                print_status "$YELLOW" "Retrying failed module: $module"
                if ! retry_module "$module"; then
                    print_status "$RED" "Module $module failed and was skipped"
                fi
            done
        else
            print_status "$GREEN" "All modules in $group_name completed successfully!"
        fi
        
        # Clean up temp directory
        cleanup_temp_dir "$temp_dir"
        
        print_status "$GREEN" "Completed $group_name"
    done

    print_status "$GREEN" "All groups processed!"
}

# Check for jq dependency
if ! command -v jq &> /dev/null; then
    print_status "$RED" "This script requires jq for JSON processing. Please install it first."
    echo "On Ubuntu/Debian: sudo apt-get install jq"
    echo "On CentOS/RHEL: sudo yum install jq"
    echo "On macOS: brew install jq"
    exit 1
fi

# Run the main script
main