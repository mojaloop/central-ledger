package io.mojaloop.centralledger.jmeter;

import io.mojaloop.centralledger.jmeter.rest.client.DFSPClient;
import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.centralledger.jmeter.runner.SamplerRunner;
import io.mojaloop.centralledger.jmeter.util.TestDataUtil;
import org.apache.jmeter.config.Arguments;
import org.apache.jmeter.protocol.java.sampler.AbstractJavaSamplerClient;
import org.apache.jmeter.protocol.java.sampler.JavaSamplerContext;
import org.apache.jmeter.samplers.SampleResult;
import org.slf4j.Logger;

import java.io.File;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 *
 */
public class StressTestMappingSampler extends AbstractJavaSamplerClient {
	/**
	 * Arguments accepted by the sampler.
	 */
	private static class Arg {
		private static final String _0_INPUT_FILE = "inputFile";
		private static final String _1_URL = "url";
	}

	private Logger logger = this.getNewLogger();

	private String inputFile = null;
	private String url = "http://localhost:3001";

	private DFSPClient dfspClient = null;

	private int counter;
	private int commandCount;

	private List<TestDataCarrier> allTestData;
	private List<Participant> allParticipants = null;

	private Map<String, Object> validPrepare = new ConcurrentHashMap<>();

	@Override
	public void setupTest(JavaSamplerContext context) {
		super.setupTest(context);
		this.logger.info("Initiating test data."+context.getJMeterProperties());
		this.counter = 0;

		//Set Params...
		this.inputFile = context.getParameter(Arg._0_INPUT_FILE);
		this.allTestData = TestDataUtil.readTestDataFromFile(new File(this.inputFile));
		this.commandCount = this.allTestData.size();
		this.logger.info(
				String.format("Test file '%s' read a total of '%d' test scenarios.",
						this.inputFile, this.commandCount));

		this.url = context.getParameter(Arg._1_URL, this.url);
		this.dfspClient = new DFSPClient(this.url);

		this.logger.info("Fetching all participants from CL.");
		this.allParticipants = TestDataUtil.filterForType(
				this.allTestData,
				TestDataCarrier.ActionType.create_participant
		).stream()
				.map(itm -> (Participant) itm.getRequest())
				.collect(Collectors.toList());

		//Populate the form containers...
		this.logger.info("Initiation of test data for [{}] COMPLETE.", this.url);
	}

	@Override
	public Arguments getDefaultParameters() {
		Arguments defaultParameters = new Arguments();
		defaultParameters.addArgument(Arg._0_INPUT_FILE, System.getProperty("user.home"));
		defaultParameters.addArgument(Arg._1_URL,this.url);
		return defaultParameters;
	}

	@Override
	public SampleResult runTest(JavaSamplerContext javaSamplerContext) {
		SampleResult returnVal = new SampleResult();
		if (this.allTestData == null) return returnVal;

		TestDataCarrier testData = this.allTestData.get(this.counter);
		returnVal.setSentBytes(testData.toString().getBytes().length);

		String testDataType = testData.getActionType().name();
		try {
			returnVal.setSampleLabel(String.format("[%s]:[%s]", this.url, testDataType));
			returnVal.setURL(new URL(this.url));
			returnVal.setDataType(SampleResult.TEXT);
			returnVal.setContentType("application/json");

			//The execution utility...
			SamplerRunner sr = new SamplerRunner(this.logger, this.dfspClient, this.allParticipants);
			sr.execute(testData, returnVal, this.counter + 1);
		} catch (MalformedURLException eParam) {
			throw new IllegalStateException(eParam.getMessage(), eParam);
		} finally {
			this.counter++;
			if (this.counter >= this.commandCount) this.counter = 0;
		}
		return returnVal;
	}

	@Override
	public void teardownTest(JavaSamplerContext context) {
		super.teardownTest(context);

		SamplerRunner.clearQueues();
		this.allParticipants = null;
	}
}
