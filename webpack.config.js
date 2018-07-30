const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    output: {
        library: 'digitaljs'
    },
    devtool: "source-map",
    module: {
        rules: [
            {
                test: /\.css/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
            {
                test: /\.js/,
                loader: 'babel-loader',
                exclude: /node_modules/,
                query: {
                    presets: ['env']
                }
            }, {
                test: require.resolve('jquery'),
                use: [{
                    loader: 'expose-loader',
                    options: '$'
                }]
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/test.html',
            inject: 'head'
        })
    ]
}

