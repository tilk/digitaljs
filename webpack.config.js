const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
    output: {
        library: 'digitaljs'
    },
    devtool: "source-map",
    resolve: {
        extensions: ['.js', '.jsx', '.json', '.css']
    },
    module: {
        rules: [
            {
                test: /\.css/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            },
/*            {
                test: /\.png/,
                use: [
                    'file-loader'
                ]
            },*/
            {
                test: /\.svg|\.png/,
                use: [
                    'base64-inline-loader?limit=1000&name=[name].[ext]'
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
            title: 'Full Adder',
            template: 'src/test/template.html',
            test: JSON.stringify(require('./src/test/fulladder.json')),
            filename: 'test/fulladder.html',
            inject: 'head'
        })
    ]
}

