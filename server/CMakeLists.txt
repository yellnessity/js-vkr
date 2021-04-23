cmake_minimum_required(VERSION 3.10)
project("video_stream" VERSION 1.0.0)

add_library(
    ${PROJECT_NAME}
    SHARED
    ${CMAKE_JS_SRC}
    ${CMAKE_CURRENT_SOURCE_DIR}/src/main.cpp
)

target_link_libraries(
    ${PROJECT_NAME}
    PRIVATE
    ${CMAKE_JS_LIB}
)

# Include N-API wrappers
execute_process(
    COMMAND node -p "require('node-addon-api').include"
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
)
string(REGEX REPLACE "[\r\n\"]" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

target_include_directories(
    ${PROJECT_NAME}
    PRIVATE
    ${NODE_ADDON_API_DIR}
    ${CMAKE_JS_INC}
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)


if(WIN32)

    target_compile_definitions(
        ${PROJECT_NAME} PRIVATE UNICODE _UNICODE
    )

    target_link_libraries(
        ${PROJECT_NAME}
        PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/win32/welsdcore.lib
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/win32/WelsDecPlus.lib
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/win32/welsecore.lib
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/win32/WelsEncPlus.lib
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/win32/WelsVP.lib
    )

elseif(UNIX)

    target_link_libraries(
        ${PROJECT_NAME}
        PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/lib/linux/libopenh264.a
    )

endif()


if("${CMAKE_C_COMPILER_ID}" STREQUAL "MSVC" OR "${CMAKE_CXX_COMPILER_ID}" STREQUAL "MSVC")

    target_compile_options(${PROJECT_NAME} PRIVATE /W4 /Ox /volatile:iso /utf-8)

elseif("${CMAKE_C_COMPILER_ID}" STREQUAL "GNU" OR "${CMAKE_CXX_COMPILER_ID}" STREQUAL "GNU")

    target_link_libraries(${PROJECT_NAME} PUBLIC pthread)
    target_compile_options(${PROJECT_NAME} PRIVATE -Wall -Wextra -pedantic -O3 -lc++fs)

endif()


target_compile_features(
    ${PROJECT_NAME}
    PUBLIC
    c_std_11
    cxx_std_17
)

set_target_properties(
    ${PROJECT_NAME}
    PROPERTIES
    C_STANDARD 11
    C_STANDARD_REQUIRED ON
    C_EXTENSIONS OFF
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
    PREFIX "" SUFFIX ".node"
)
