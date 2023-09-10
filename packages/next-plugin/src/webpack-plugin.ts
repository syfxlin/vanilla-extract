import { VanillaExtractPlugin } from '@vanilla-extract/webpack-plugin';

export class VanillaExtractWebpackPlugin extends VanillaExtractPlugin {
  apply(compiler) {
    super.apply(compiler);
    for (const rule of compiler.options.module?.rules ?? []) {
      if (rule && typeof rule === 'object' && rule.test === this.test) {
        rule.use = [
          {
            loader: require.resolve('../../loader'),
            options: {
              outputCss: this.outputCss,
              childCompiler: this.childCompiler,
              identifiers: this.identifiers,
            },
          },
        ];
        break;
      }
    }
  }
}
